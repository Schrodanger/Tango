// Content script for Tango Solver (works on custom Tango games and LinkedIn)

(function() {
  'use strict';
  
  const EMPTY = 0, SUN = 1, MOON = 2;
  
  // Add a floating solve button on Tango puzzle pages
  function addFloatingButton() {
    const hasTango = document.querySelector('svg[aria-label="Sun"]') || 
                     document.querySelector('svg[aria-label="Moon"]') ||
                     document.querySelector('.cell') ||
                     document.querySelector('.puzzle-grid') ||
                     document.body.innerText.includes('Tango');
    
    if (!hasTango) return;
    if (document.getElementById('tango-solver-btn')) return;
    
    const btn = document.createElement('button');
    btn.id = 'tango-solver-btn';
    btn.innerHTML = '🧩 Solve Tango';
    btn.onclick = window.solveTangoPuzzle;
    document.body.appendChild(btn);
  }
  
  // ===== SOLVER ALGORITHM =====
  function solvePuzzle(grid, constraints, gridSize, fixedCells) {
    const solution = grid.map(row => [...row]);
    const fixed = fixedCells || grid.map(row => row.map(cell => cell !== EMPTY));
    
    function isValid(grid, row, col, value) {
      // Check row count (max 3 of same type in a row of 6)
      const maxPerLine = gridSize / 2;
      let rowCount = 0;
      for (let c = 0; c < gridSize; c++) {
        if (grid[row][c] === value) rowCount++;
      }
      if (rowCount >= maxPerLine) return false;
      
      // Check column count
      let colCount = 0;
      for (let r = 0; r < gridSize; r++) {
        if (grid[r][col] === value) colCount++;
      }
      if (colCount >= maxPerLine) return false;
      
      // Check no more than 2 consecutive in row
      // Check left
      if (col >= 2 && grid[row][col-1] === value && grid[row][col-2] === value) return false;
      // Check right
      if (col <= gridSize-3 && grid[row][col+1] === value && grid[row][col+2] === value) return false;
      // Check middle
      if (col >= 1 && col <= gridSize-2 && grid[row][col-1] === value && grid[row][col+1] === value) return false;
      
      // Check no more than 2 consecutive in column
      if (row >= 2 && grid[row-1][col] === value && grid[row-2][col] === value) return false;
      if (row <= gridSize-3 && grid[row+1][col] === value && grid[row+2][col] === value) return false;
      if (row >= 1 && row <= gridSize-2 && grid[row-1][col] === value && grid[row+1][col] === value) return false;
      
      // Check constraints
      for (const c of constraints) {
        let cell1Val, cell2Val;
        if (c.type === 'h') {
          // Horizontal constraint between (row, col) and (row, col+1)
          cell1Val = (c.row === row && c.col === col) ? value : grid[c.row][c.col];
          cell2Val = (c.row === row && c.col + 1 === col) ? value : grid[c.row][c.col + 1];
        } else {
          // Vertical constraint between (row, col) and (row+1, col)
          cell1Val = (c.row === row && c.col === col) ? value : grid[c.row][c.col];
          cell2Val = (c.row + 1 === row && c.col === col) ? value : grid[c.row + 1][c.col];
        }
        
        if (cell1Val !== EMPTY && cell2Val !== EMPTY) {
          if (c.constraint === '=' && cell1Val !== cell2Val) return false;
          if (c.constraint === 'x' && cell1Val === cell2Val) return false;
        }
      }
      
      return true;
    }
    
    function solve(grid) {
      // Find next cell to fill (skip fixed cells)
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          if (grid[row][col] === EMPTY && !fixed[row][col]) {
            for (const value of [SUN, MOON]) {
              if (isValid(grid, row, col, value)) {
                grid[row][col] = value;
                if (solve(grid)) return true;
                grid[row][col] = EMPTY;
              }
            }
            return false;
          }
        }
      }
      return true; // All cells filled
    }
    
    if (solve(solution)) {
      return solution;
    }
    return null;
  }
  
  // ===== LINKEDIN DETECTION =====
  function isLinkedIn() {
    return window.location.hostname.includes('linkedin.com');
  }
  
  function detectLinkedInGrid() {
    console.log('Detecting LinkedIn grid...');
    
    // LinkedIn uses SVG icons - find all sun and moon icons
    const sunIcons = document.querySelectorAll('svg[aria-label="Sun"], [aria-label="Sun"] svg, img[alt*="sun" i]');
    const moonIcons = document.querySelectorAll('svg[aria-label="Moon"], [aria-label="Moon"] svg, img[alt*="moon" i]');
    
    console.log('Found sun icons:', sunIcons.length);
    console.log('Found moon icons:', moonIcons.length);
    
    // Try multiple strategies to find the grid cells
    let clickableCells = [];
    let gridContainer = null;
    
    // Strategy 1: Find the grid container by looking at parent of sun/moon icons
    if (sunIcons.length > 0 || moonIcons.length > 0) {
      const sampleIcon = sunIcons[0] || moonIcons[0];
      // Navigate up to find the grid container
      let container = sampleIcon.parentElement;
      for (let i = 0; i < 10 && container; i++) {
        // Look for a container that has ~36 descendant clickable areas
        const buttons = container.querySelectorAll('button, [role="button"], [tabindex="0"]');
        if (buttons.length >= 36) {
          // Filter to only cells (not other buttons like Hint/Undo)
          const cellButtons = Array.from(buttons).filter(btn => {
            const rect = btn.getBoundingClientRect();
            return rect.width > 30 && rect.width < 80 && rect.height > 30 && rect.height < 80;
          });
          if (cellButtons.length >= 36) {
            clickableCells = cellButtons;
            gridContainer = container;
            console.log('Strategy 1: Found', clickableCells.length, 'cell buttons');
            break;
          }
        }
        container = container.parentElement;
      }
    }
    
    // Strategy 2: Find all buttons/clickable elements that look like grid cells
    if (clickableCells.length === 0) {
      const allButtons = document.querySelectorAll('button, [role="button"], [tabindex="0"], [role="gridcell"]');
      console.log('Strategy 2: All buttons found:', allButtons.length);
      
      const cellButtons = Array.from(allButtons).filter(btn => {
        const rect = btn.getBoundingClientRect();
        // Cells should be square-ish and similar size
        return rect.width > 30 && rect.width < 80 && rect.height > 30 && rect.height < 80 &&
               Math.abs(rect.width - rect.height) < 10;
      });
      
      if (cellButtons.length >= 36) {
        clickableCells = cellButtons;
        console.log('Strategy 2: Found', clickableCells.length, 'cell buttons');
      }
    }
    
    // Strategy 3: Look for elements with specific LinkedIn game classes
    if (clickableCells.length === 0) {
      const gameElements = document.querySelectorAll('[class*="game"] button, [class*="puzzle"] button, [class*="board"] button, [class*="grid"] button');
      console.log('Strategy 3: Game buttons found:', gameElements.length);
      if (gameElements.length >= 36) {
        clickableCells = Array.from(gameElements);
      }
    }
    
    if (clickableCells.length < 36) {
      console.log('Not enough grid cells found:', clickableCells.length);
      return null;
    }
    
    // Take exactly 36 cells (6x6) - filter by position to get the grid
    const cellRects = clickableCells.map(cell => ({
      cell,
      rect: cell.getBoundingClientRect()
    }));
    
    // Sort by visual position (top to bottom, left to right)
    cellRects.sort((a, b) => {
      const rowDiff = Math.round((a.rect.top - b.rect.top) / 30);
      if (rowDiff !== 0) return rowDiff;
      return a.rect.left - b.rect.left;
    });
    
    // Determine grid size from cells
    const gridSize = 6; // LinkedIn Tango is 6x6
    const gridCells = cellRects.slice(0, gridSize * gridSize);
    
    console.log('Grid size:', gridSize, 'Total cells used:', gridCells.length);
    
    const grid = [];
    const cellMap = {};
    const fixedCells = [];
    
    for (let i = 0; i < gridSize; i++) {
      grid.push([]);
      fixedCells.push([]);
      for (let j = 0; j < gridSize; j++) {
        const idx = i * gridSize + j;
        const cellData = gridCells[idx];
        
        if (!cellData) {
          grid[i].push(EMPTY);
          fixedCells[i].push(false);
          continue;
        }
        
        const cell = cellData.cell;
        cellMap[`${i}-${j}`] = cell;
        
        // Detect current state - look for sun/moon anywhere in the cell or its parent
        const cellContent = cell.innerHTML.toLowerCase();
        const parentContent = cell.parentElement?.innerHTML.toLowerCase() || '';
        
        const hasSun = cell.querySelector('svg[aria-label="Sun"]') || 
                       cell.querySelector('[aria-label="Sun"]') ||
                       cellContent.includes('aria-label="sun"');
        const hasMoon = cell.querySelector('svg[aria-label="Moon"]') || 
                        cell.querySelector('[aria-label="Moon"]') ||
                        cellContent.includes('aria-label="moon"');
        
        // Pre-filled cells have content
        const isFixed = hasSun || hasMoon;
        
        if (hasSun) {
          grid[i].push(SUN);
          fixedCells[i].push(true);
        } else if (hasMoon) {
          grid[i].push(MOON);
          fixedCells[i].push(true);
        } else {
          grid[i].push(EMPTY);
          fixedCells[i].push(false);
        }
        
        console.log(`Cell [${i}][${j}]: sun=${!!hasSun}, moon=${!!hasMoon}, fixed=${fixedCells[i][j]}`);
      }
    }
    
    // Detect constraints (= and × symbols) - pass all cell rects for position mapping
    const constraints = detectLinkedInConstraints(gridSize, gridCells[0]?.rect, gridCells, gridContainer);
    console.log('Constraints detected:', constraints.length);
    
    return { grid, cellMap, constraints, gridSize, fixedCells };
  }
  
  function detectLinkedInConstraints(gridSize, firstCellRect, allCellRects, gridContainer) {
    const constraints = [];
    if (!firstCellRect || !allCellRects || allCellRects.length === 0) return constraints;
    
    console.log('Detecting LinkedIn constraints...');
    
    // Helper to identify if an element is a constraint
    function identifyConstraint(el) {
      if (!el) return null;
      
      // Check text content
      const text = el.textContent?.trim();
      if (text === '=' || text === '==' ) return '=';
      if (text === '×' || text === 'x' || text === 'X' || text === '✕') return 'x';
      
      // Check aria-label
      const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
      if (ariaLabel.includes('equal') || ariaLabel.includes('same')) return '=';
      if (ariaLabel.includes('opposite') || ariaLabel.includes('different')) return 'x';
      
      // Check class names
      const className = (el.className instanceof SVGAnimatedString ? el.className.baseVal : el.className) || '';
      if (typeof className === 'string') {
        const lowerClass = className.toLowerCase();
        if (lowerClass.includes('equal') || lowerClass.includes('same-indicator')) return '=';
        if (lowerClass.includes('cross') || lowerClass.includes('diff-indicator') || lowerClass.includes('opposite')) return 'x';
      }
      
      // Check for specific SVG paths or attributes if known (generic check)
      if (el.tagName === 'svg' || el.tagName === 'path') {
        // Sometimes SVGs have titles
        const title = el.querySelector('title')?.textContent?.toLowerCase();
        if (title) {
          if (title.includes('equal')) return '=';
          if (title.includes('opposite') || title.includes('cross')) return 'x';
        }
      }

      return null;
    }

    // Helper to check pseudo-elements
    function checkPseudo(el, type) {
      if (!el) return null;
      const style = window.getComputedStyle(el, type);
      const content = style.content;
      if (content && content !== 'none') {
        if (content.includes('=') || content.includes('equals')) return '=';
        if (content.includes('x') || content.includes('X')) return 'x';
      }
      return null;
    }

    // Collect potential constraint elements from container to avoid full DOM scan
    let potentialElements = [];
    if (gridContainer) {
      potentialElements = Array.from(gridContainer.querySelectorAll('*'));
    } else {
      // Fallback: use elements near the grid
      // This is expensive so we skip it or limit it
      potentialElements = Array.from(document.body.querySelectorAll('div, span, svg, img')); 
    }

    // Filter potential elements to those that look like constraints to speed up spatial check
    // (Optional optimization, but let's just check all in the spatial loop for accuracy)

    // For each pair of adjacent cells, look for constraint elements between them
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const cellIdx = row * gridSize + col;
        const cellData = allCellRects[cellIdx];
        if (!cellData) continue;
        
        const cell = cellData.cell;

        // Check for HORIZONTAL constraint (between this cell and the one to the right)
        if (col < gridSize - 1) {
          const nextCellData = allCellRects[cellIdx + 1];
          if (nextCellData) {
            let constraint = null;
            
            // 1. Check pseudo-elements
            constraint = checkPseudo(cell, '::after') || checkPseudo(nextCellData.cell, '::before');
            
            // 2. Check spatial elements
            if (!constraint) {
              const betweenLeft = cellData.rect.right - 10;
              const betweenRight = nextCellData.rect.left + 10;
              const betweenTop = cellData.rect.top;
              const betweenBottom = cellData.rect.bottom;
              
              // Check elementsFromPoint center
              const centerEls = document.elementsFromPoint((betweenLeft + betweenRight)/2, (betweenTop + betweenBottom)/2);
              for (const el of centerEls) {
                constraint = identifyConstraint(el);
                if (constraint) break;
              }
              
              // Check all potential elements if not found
              if (!constraint) {
                for (const el of potentialElements) {
                  const rect = el.getBoundingClientRect();
                  const cx = rect.left + rect.width / 2;
                  const cy = rect.top + rect.height / 2;
                  if (cx >= betweenLeft && cx <= betweenRight && cy >= betweenTop && cy <= betweenBottom) {
                    constraint = identifyConstraint(el);
                    if (constraint) break;
                  }
                }
              }
            }

            if (constraint) {
              constraints.push({ type: 'h', row, col, constraint });
              console.log(`H constraint at [${row}][${col}]: ${constraint}`);
            }
          }
        }
        
        // Check for VERTICAL constraint (between this cell and the one below)
        if (row < gridSize - 1) {
          const belowCellData = allCellRects[cellIdx + gridSize];
          if (belowCellData) {
            let constraint = null;
            
            // 1. Check pseudo-elements
            constraint = checkPseudo(cell, '::after') || checkPseudo(belowCellData.cell, '::before'); // CSS usually doesn't do bottom/top pseudos easily but check anyway
            
            // 2. Check spatial elements
            if (!constraint) {
              const betweenLeft = cellData.rect.left;
              const betweenRight = cellData.rect.right;
              const betweenTop = cellData.rect.bottom - 10;
              const betweenBottom = belowCellData.rect.top + 10;
              
              // Check elementsFromPoint center
              const centerEls = document.elementsFromPoint((betweenLeft + betweenRight)/2, (betweenTop + betweenBottom)/2);
              for (const el of centerEls) {
                constraint = identifyConstraint(el);
                if (constraint) break;
              }
              
              // Check all potential elements
              if (!constraint) {
                for (const el of potentialElements) {
                  const rect = el.getBoundingClientRect();
                  const cx = rect.left + rect.width / 2;
                  const cy = rect.top + rect.height / 2;
                  if (cx >= betweenLeft && cx <= betweenRight && cy >= betweenTop && cy <= betweenBottom) {
                    constraint = identifyConstraint(el);
                    if (constraint) break;
                  }
                }
              }
            }

            if (constraint) {
              constraints.push({ type: 'v', row, col, constraint });
              console.log(`V constraint at [${row}][${col}]: ${constraint}`);
            }
          }
        }
      }
    }
    
    console.log('Total constraints found:', constraints.length);
    return constraints;
  }
  
  function findConstraintInArea(left, right, top, bottom) {
    // Deprecated - logic moved inside detectLinkedInConstraints
    return null;
  }
  
  // ===== LOCAL GAME DETECTION =====
  function detectLocalGame() {
    // Try to read solution from page
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        if (typeof solution !== 'undefined' && Array.isArray(solution)) {
          document.body.dataset.tangoSolution = JSON.stringify(solution);
        }
        if (typeof givenCells !== 'undefined') {
          document.body.dataset.tangoGiven = JSON.stringify(givenCells);
        }
        if (typeof constraints !== 'undefined') {
          document.body.dataset.tangoConstraints = JSON.stringify(constraints);
        }
      })();
    `;
    document.head.appendChild(script);
    script.remove();
    
    const cells = document.querySelectorAll('.cell');
    if (cells.length === 0) return null;
    
    const gridSize = Math.sqrt(cells.length);
    if (!Number.isInteger(gridSize)) return null;
    
    // Build cell map and grid
    const cellMap = {};
    const grid = [];
    const fixedCells = [];
    
    for (let i = 0; i < gridSize; i++) {
      grid.push([]);
      fixedCells.push([]);
      for (let j = 0; j < gridSize; j++) {
        grid[i].push(EMPTY);
        fixedCells[i].push(false);
      }
    }
    
    cells.forEach(cell => {
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      if (!isNaN(row) && !isNaN(col)) {
        cellMap[`${row}-${col}`] = cell;
        
        if (cell.classList.contains('sun')) grid[row][col] = SUN;
        else if (cell.classList.contains('moon')) grid[row][col] = MOON;
        
        if (cell.classList.contains('fixed')) fixedCells[row][col] = true;
      }
    });
    
    // Read constraints from page variable
    let constraints = [];
    try {
      const constraintData = document.body.dataset.tangoConstraints;
      if (constraintData) {
        constraints = JSON.parse(constraintData);
        console.log('Constraints from variable:', constraints);
      }
    } catch (e) {}
    
    // If no constraints from variable, read from DOM
    if (constraints.length === 0) {
      const constraintElements = document.querySelectorAll('.constraint');
      console.log('Found constraint elements:', constraintElements.length);
      
      constraintElements.forEach(el => {
        const isHorizontal = el.classList.contains('horizontal');
        const isEquals = el.classList.contains('equals') || el.textContent.trim() === '=';
        const constraintType = isEquals ? '=' : 'x';
        
        // Parse position from style
        const left = parseFloat(el.style.left) || 0;
        const top = parseFloat(el.style.top) || 0;
        
        // Cell size is 60px
        const cellSize = 60;
        
        let row, col;
        if (isHorizontal) {
          // Horizontal: marker.style.left = `${(c.col + 1) * 60}px`; top = `${c.row * 60 + 30}px`
          col = Math.round(left / cellSize) - 1;
          row = Math.round((top - 30) / cellSize);
        } else {
          // Vertical: marker.style.left = `${c.col * 60 + 30}px`; top = `${(c.row + 1) * 60}px`
          col = Math.round((left - 30) / cellSize);
          row = Math.round(top / cellSize) - 1;
        }
        
        if (row >= 0 && col >= 0 && row < gridSize && col < gridSize) {
          constraints.push({
            type: isHorizontal ? 'h' : 'v',
            row: row,
            col: col,
            constraint: constraintType
          });
          console.log(`Constraint: ${isHorizontal ? 'h' : 'v'} at [${row}][${col}] = ${constraintType}`);
        }
      });
    }
    
    console.log('Total constraints:', constraints);
    
    // Read solution if available
    let existingSolution = null;
    try {
      const solutionData = document.body.dataset.tangoSolution;
      if (solutionData) {
        existingSolution = JSON.parse(solutionData);
      }
    } catch (e) {}
    
    return { grid, cellMap, constraints, gridSize, fixedCells, existingSolution };
  }
  
  // ===== MAIN SOLVE FUNCTION =====
  window.solveTangoPuzzle = function() {
    console.log('=== Tango Solver Starting ===');
    
    let puzzleData;
    let solutionGrid;
    
    if (isLinkedIn()) {
      console.log('Detected LinkedIn puzzle');
      puzzleData = detectLinkedInGrid();
      if (!puzzleData) {
        alert('Could not detect LinkedIn Tango puzzle. Try refreshing the page and make sure the puzzle is visible.');
        return { success: false };
      }
      // Solve LinkedIn puzzle with fixedCells
      console.log('LinkedIn Grid:', puzzleData.grid);
      console.log('LinkedIn Constraints:', puzzleData.constraints);
      console.log('LinkedIn Fixed cells:', puzzleData.fixedCells);
      solutionGrid = solvePuzzle(puzzleData.grid, puzzleData.constraints, puzzleData.gridSize, puzzleData.fixedCells);
    } else {
      console.log('Detected local puzzle');
      puzzleData = detectLocalGame();
      if (!puzzleData) {
        alert('Could not detect Tango puzzle');
        return { success: false };
      }
      
      // Always solve using backtracking
      console.log('Solving puzzle...');
      console.log('Grid:', puzzleData.grid);
      console.log('Constraints:', puzzleData.constraints);
      console.log('Fixed cells:', puzzleData.fixedCells);
      solutionGrid = solvePuzzle(puzzleData.grid, puzzleData.constraints, puzzleData.gridSize, puzzleData.fixedCells);
    }
    
    if (!solutionGrid) {
      alert('Could not solve the puzzle');
      return { success: false };
    }
    
    console.log('Solution:', solutionGrid);
    
    const { cellMap, gridSize, fixedCells } = puzzleData;
    const clickQueue = [];
    
    // Build click queue
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const cell = cellMap[`${row}-${col}`];
        if (!cell) continue;
        
        // Skip fixed/given cells
        if (cell.classList && cell.classList.contains('fixed')) {
          continue;
        }
        if (fixedCells && fixedCells[row] && fixedCells[row][col]) {
          continue;
        }
        
        const target = solutionGrid[row][col];
        
        // Get current state
        let current = EMPTY;
        if (isLinkedIn()) {
          if (cell.querySelector('svg[aria-label="Sun"]')) current = SUN;
          else if (cell.querySelector('svg[aria-label="Moon"]')) current = MOON;
        } else {
          if (cell.classList.contains('sun')) current = SUN;
          else if (cell.classList.contains('moon')) current = MOON;
        }
        
        // Calculate clicks needed (cycle: Empty -> Sun -> Moon -> Empty)
        let clicksNeeded = 0;
        if (current === EMPTY && target === SUN) clicksNeeded = 1;
        else if (current === EMPTY && target === MOON) clicksNeeded = 2;
        else if (current === SUN && target === MOON) clicksNeeded = 1;
        else if (current === SUN && target === EMPTY) clicksNeeded = 2;
        else if (current === MOON && target === EMPTY) clicksNeeded = 1;
        else if (current === MOON && target === SUN) clicksNeeded = 2;
        
        for (let i = 0; i < clicksNeeded; i++) {
          clickQueue.push(cell);
        }
      }
    }
    
    console.log(`Total clicks: ${clickQueue.length}`);
    
    // Execute clicks
    let clickIndex = 0;
    const clickInterval = setInterval(() => {
      if (clickIndex >= clickQueue.length) {
        clearInterval(clickInterval);
        console.log('Solved!');
        
        const btn = document.getElementById('tango-solver-btn');
        if (btn) {
          btn.innerHTML = '✅ Solved!';
          btn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
        }
        return;
      }
      
      // Simulate a real click with mouse events for better compatibility
      const cell = clickQueue[clickIndex];
      simulateClick(cell);
      clickIndex++;
    }, 100); // 100ms between clicks for LinkedIn to process
    
    return { success: true };
  };
  
  // Simulate a real mouse click (works better on React/modern apps)
  function simulateClick(element) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    // Dispatch mouse events
    const mouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y
    });
    
    const mouseUp = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y
    });
    
    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y
    });
    
    element.dispatchEvent(mouseDown);
    element.dispatchEvent(mouseUp);
    element.dispatchEvent(click);
    
    // Also try direct click as fallback
    if (element.click) {
      element.click();
    }
  }
  
  // Initialize
  setTimeout(addFloatingButton, 1000);
  setInterval(addFloatingButton, 3000);
})();
