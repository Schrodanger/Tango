// Popup script for LinkedIn Tango Solver

document.getElementById('readBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  status.className = 'status info';
  status.textContent = 'Reading puzzle...';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: readPuzzle
    });
    
    if (result[0].result) {
      const data = result[0].result;
      if (data.success) {
        status.className = 'status success';
        status.textContent = `✓ Found ${data.gridSize}x${data.gridSize} grid with ${data.filledCells} filled cells`;
      } else {
        status.className = 'status error';
        status.textContent = data.message || 'Could not read puzzle';
      }
    }
  } catch (error) {
    status.className = 'status error';
    status.textContent = 'Error: Make sure you are on LinkedIn Tango page';
    console.error(error);
  }
});

document.getElementById('solveBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  status.className = 'status info';
  status.textContent = 'Solving puzzle...';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: solvePuzzle
    });
    
    if (result[0].result) {
      const data = result[0].result;
      if (data.success) {
        status.className = 'status success';
        status.textContent = '✓ Puzzle solved! Check the page.';
      } else {
        status.className = 'status error';
        status.textContent = data.message || 'Could not solve puzzle';
      }
    }
  } catch (error) {
    status.className = 'status error';
    status.textContent = 'Error: ' + error.message;
    console.error(error);
  }
});

// Function to read the puzzle state from LinkedIn
function readPuzzle() {
  try {
    // Find all cells by data-testid
    const cells = document.querySelectorAll('[data-testid^="cell-"]');
    
    let sunCount = 0, moonCount = 0;
    cells.forEach(cell => {
      if (cell.querySelector('svg[aria-label="Sun"]')) sunCount++;
      if (cell.querySelector('svg[aria-label="Moon"]')) moonCount++;
    });
    
    // Determine grid size
    const gridSize = Math.sqrt(cells.length) || 4;
    
    if (cells.length === 0) {
      return { success: false, message: 'No puzzle cells found on this page' };
    }
    
    return {
      success: true,
      gridSize: Math.round(gridSize),
      filledCells: sunCount + moonCount,
      totalCells: cells.length
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// Function to solve and fill the puzzle
function solvePuzzle() {
  try {
    const EMPTY = 0, SUN = 1, MOON = 2;
    let GRID_SIZE = 4; // Will be auto-detected
    
    console.log('=== Tango Solver Starting (from popup) ===');
    
    // Find cells by locating SVG icons
    function findAllCells() {
      const cellMap = {};
      const allSuns = document.querySelectorAll('svg[aria-label="Sun"]');
      const allMoons = document.querySelectorAll('svg[aria-label="Moon"]');
      
      console.log('Found Sun SVGs:', allSuns.length);
      console.log('Found Moon SVGs:', allMoons.length);
      
      const iconPositions = [];
      [...allSuns, ...allMoons].forEach(svg => {
        const rect = svg.getBoundingClientRect();
        iconPositions.push({ x: rect.left, y: rect.top, element: svg });
      });
      
      if (iconPositions.length === 0) {
        return { cellMap: {}, detectedSize: 4 };
      }
      
      const minX = Math.min(...iconPositions.map(p => p.x));
      const maxX = Math.max(...iconPositions.map(p => p.x));
      const minY = Math.min(...iconPositions.map(p => p.y));
      const maxY = Math.max(...iconPositions.map(p => p.y));
      
      const allClickables = document.querySelectorAll('div, button, [role="button"], [tabindex]');
      const gridCells = [];
      
      allClickables.forEach(el => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const padding = 50;
        
        if (centerX >= minX - padding && centerX <= maxX + padding &&
            centerY >= minY - padding && centerY <= maxY + padding &&
            rect.width > 30 && rect.width < 150 &&
            rect.height > 30 && rect.height < 150) {
          const isClickable = el.onclick || el.getAttribute('role') === 'button' ||
                             el.tagName === 'BUTTON' || el.getAttribute('tabindex') === '0' ||
                             window.getComputedStyle(el).cursor === 'pointer';
          if (isClickable || el.querySelector('svg')) {
            gridCells.push({ element: el, x: centerX, y: centerY });
          }
        }
      });
      
      const filteredCells = gridCells.filter((cell, idx) => {
        return !gridCells.some((other, otherIdx) => {
          if (idx === otherIdx) return false;
          return cell.element.contains(other.element) && cell.element !== other.element;
        });
      });
      
      filteredCells.sort((a, b) => {
        const rowDiff = Math.round((a.y - b.y) / 50);
        if (rowDiff !== 0) return rowDiff;
        return a.x - b.x;
      });
      
      const rows = [];
      let currentRow = [];
      let lastY = -1000;
      
      filteredCells.forEach(cell => {
        if (Math.abs(cell.y - lastY) > 30) {
          if (currentRow.length > 0) rows.push(currentRow);
          currentRow = [cell];
          lastY = cell.y;
        } else {
          currentRow.push(cell);
        }
      });
      if (currentRow.length > 0) rows.push(currentRow);
      
      // Auto-detect grid size
      const gridRows = rows.filter(row => row.length >= 4 && row.length <= 8);
      if (gridRows.length >= 4) {
        const rowLengths = gridRows.map(r => r.length);
        const detectedSize = Math.min(...rowLengths.filter(len => len >= 4));
        if (detectedSize >= 4 && detectedSize <= 8) {
          GRID_SIZE = detectedSize;
          console.log(`Auto-detected grid size: ${GRID_SIZE}x${GRID_SIZE}`);
        }
      }
      
      rows.slice(0, GRID_SIZE).forEach((row, rowIdx) => {
        row.sort((a, b) => a.x - b.x);
        row.slice(0, GRID_SIZE).forEach((cell, colIdx) => {
          cellMap[`${rowIdx}-${colIdx}`] = cell.element;
        });
      });
      
      return { cellMap, detectedSize: GRID_SIZE };
    }
    
    function readGrid(cellMap, gridSize) {
      const grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(EMPTY));
      const fixed = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
      
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          const cell = cellMap[`${row}-${col}`];
          if (cell) {
            const hasSun = cell.querySelector('svg[aria-label="Sun"]');
            const hasMoon = cell.querySelector('svg[aria-label="Moon"]');
            if (hasSun) { grid[row][col] = SUN; fixed[row][col] = true; }
            else if (hasMoon) { grid[row][col] = MOON; fixed[row][col] = true; }
          }
        }
      }
      return { grid, fixed };
    }
    
    function isValid(grid, row, col, value, gridSize) {
      const maxPerLine = gridSize / 2;
      let rowCount = 0, colCount = 0;
      for (let i = 0; i < gridSize; i++) {
        if (grid[row][i] === value) rowCount++;
        if (grid[i][col] === value) colCount++;
      }
      if (rowCount >= maxPerLine || colCount >= maxPerLine) return false;
      
      const oldVal = grid[row][col];
      grid[row][col] = value;
      for (let c = 0; c <= gridSize - 3; c++) {
        if (grid[row][c] && grid[row][c] === grid[row][c+1] && grid[row][c] === grid[row][c+2]) {
          grid[row][col] = oldVal; return false;
        }
      }
      for (let r = 0; r <= gridSize - 3; r++) {
        if (grid[r][col] && grid[r][col] === grid[r+1][col] && grid[r][col] === grid[r+2][col]) {
          grid[row][col] = oldVal; return false;
        }
      }
      grid[row][col] = oldVal;
      return true;
    }
    
    function solve(grid, gridSize) {
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (grid[r][c] === EMPTY) {
            for (const value of [SUN, MOON]) {
              if (isValid(grid, r, c, value, gridSize)) {
                grid[r][c] = value;
                if (solve(grid, gridSize)) return true;
                grid[r][c] = EMPTY;
              }
            }
            return false;
          }
        }
      }
      return true;
    }
    
    function doClick(element) {
      element.click();
      const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
      const mouseUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
      element.dispatchEvent(mouseDown);
      element.dispatchEvent(mouseUp);
      element.dispatchEvent(click);
    }
    
    const result = findAllCells();
    const cellMap = result.cellMap;
    GRID_SIZE = result.detectedSize;
    const cellCount = Object.keys(cellMap).length;
    
    console.log('Total cells mapped:', cellCount);
    console.log('Using grid size:', GRID_SIZE);
    
    if (cellCount < GRID_SIZE * GRID_SIZE) {
      return { success: false, message: `Only found ${cellCount} cells, need ${GRID_SIZE * GRID_SIZE}` };
    }
    
    const { grid, fixed } = readGrid(cellMap, GRID_SIZE);
    
    if (solve(grid, GRID_SIZE)) {
      const clickQueue = [];
      
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          if (!fixed[row][col]) {
            const cell = cellMap[`${row}-${col}`];
            const target = grid[row][col];
            const clicksNeeded = target === SUN ? 1 : 2;
            for (let i = 0; i < clicksNeeded; i++) {
              clickQueue.push(cell);
            }
          }
        }
      }
      
      let clickIndex = 0;
      const clickInterval = setInterval(() => {
        if (clickIndex >= clickQueue.length) {
          clearInterval(clickInterval);
          return;
        }
        doClick(clickQueue[clickIndex]);
        clickIndex++;
      }, 150);
      
      return { success: true };
    }
    return { success: false, message: 'Could not find solution' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
