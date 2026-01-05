/**
 * Excel-style Ribbon Component
 * Tabbed interface for all spreadsheet operations
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Theme, useAccelStore } from '../store/accel-store';
import { ParameterPanel } from './ParameterPanel';
import { AutomationPanel } from './AutomationPanel';
import { IconButton } from './Icons';

type TabName = 'Home' | 'Insert' | 'Page Layout' | 'Formulas' | 'Data' | 'Automation' | 'Graphing' | 'Review' | 'View';

export const Ribbon: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const { selectedCell, copyCell, cutCell, pasteCell, formatCell, getCellObject, sortColumn, insertRow, deleteRow, insertColumn, deleteColumn, exportCSV } = useAccelStore();

  // Theme is managed locally to avoid triggering re-renders across the entire app
  const [localTheme, setLocalTheme] = useState<string>(() => {
    return document.documentElement.getAttribute('data-theme') || 'default';
  });

  const handleThemeChange = useCallback((newTheme: string) => {
    // Disable all transitions temporarily to prevent layout thrashing
    const style = document.createElement('style');
    style.id = 'disable-transitions';
    style.textContent = '* { transition: none !important; }';
    document.head.appendChild(style);

    // Apply theme in next frame
    requestAnimationFrame(() => {
      document.documentElement.setAttribute('data-theme', newTheme);
      setLocalTheme(newTheme);

      // Re-enable transitions after paint
      requestAnimationFrame(() => {
        setTimeout(() => {
          const disableStyle = document.getElementById('disable-transitions');
          if (disableStyle) {
            document.head.removeChild(disableStyle);
          }
        }, 50);
      });
    });
  }, []);

  const handleThemeChange = useCallback((newTheme: Theme) => {
    if (newTheme === localTheme) return;
    applyTheme(newTheme);
  }, [applyTheme, localTheme]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const safeStoredTheme = (): Theme | null => {
      try {
        return (typeof window !== 'undefined' && window.localStorage.getItem('accel-theme')) as Theme | null;
      } catch {
        return null;
      }
    };

    const storedTheme = safeStoredTheme();
    const domTheme = document.documentElement.getAttribute('data-theme') as Theme | null;
    applyTheme(storedTheme || domTheme || 'default');
  }, [applyTheme]);

  const renderHomeTab = () => (
    <>
      <div className="ribbon-group">
        <p className="ribbon-title">Clipboard</p>
        <div className="ribbon-controls">
          <IconButton
            icon="Copy"
            tooltip="Copy (Ctrl+C)"
            onClick={() => selectedCell && copyCell(selectedCell.row, selectedCell.col)}
          />
          <IconButton
            icon="Cut"
            tooltip="Cut (Ctrl+X)"
            onClick={() => selectedCell && cutCell(selectedCell.row, selectedCell.col)}
          />
          <IconButton
            icon="Paste"
            tooltip="Paste (Ctrl+V)"
            onClick={() => selectedCell && pasteCell(selectedCell.row, selectedCell.col)}
          />
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Font</p>
        <div className="ribbon-controls">
          <select className="ribbon-input" defaultValue="Calibri">
            <option>Calibri</option>
            <option>Arial</option>
            <option>Times New Roman</option>
            <option>Courier New</option>
          </select>
          <select className="ribbon-input" defaultValue="11">
            <option>8</option>
            <option>9</option>
            <option>10</option>
            <option>11</option>
            <option>12</option>
            <option>14</option>
            <option>16</option>
            <option>18</option>
            <option>20</option>
            <option>24</option>
          </select>
          <div className="button-group">
            <button
              className="ribbon-btn"
              title="Bold"
              onClick={() => {
                if (selectedCell) {
                  const cell = getCellObject(selectedCell.row, selectedCell.col);
                  formatCell(selectedCell.row, selectedCell.col, { bold: !cell?.format?.bold });
                }
              }}
            >
              <strong>B</strong>
            </button>
            <button
              className="ribbon-btn"
              title="Italic"
              onClick={() => {
                if (selectedCell) {
                  const cell = getCellObject(selectedCell.row, selectedCell.col);
                  formatCell(selectedCell.row, selectedCell.col, { italic: !cell?.format?.italic });
                }
              }}
            >
              <em>I</em>
            </button>
            <button
              className="ribbon-btn"
              title="Underline"
              onClick={() => {
                if (selectedCell) {
                  const cell = getCellObject(selectedCell.row, selectedCell.col);
                  formatCell(selectedCell.row, selectedCell.col, { underline: !cell?.format?.underline });
                }
              }}
            >
              <u>U</u>
            </button>
          </div>
          <input
            type="color"
            className="ribbon-color"
            title="Font Color"
            defaultValue="#000000"
            onChange={(e) => selectedCell && formatCell(selectedCell.row, selectedCell.col, { fontColor: e.target.value })}
          />
          <input
            type="color"
            className="ribbon-color"
            title="Fill Color"
            defaultValue="#FFFFFF"
            onChange={(e) => selectedCell && formatCell(selectedCell.row, selectedCell.col, { backgroundColor: e.target.value })}
          />
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Alignment</p>
        <div className="ribbon-controls">
          <div className="button-group">
            <button className="ribbon-btn" title="Align Left">≡</button>
            <button className="ribbon-btn" title="Center">≣</button>
            <button className="ribbon-btn" title="Align Right">≡</button>
          </div>
          <div className="button-group">
            <button className="ribbon-btn" title="Top Align">⇈</button>
            <button className="ribbon-btn" title="Middle Align">⇕</button>
            <button className="ribbon-btn" title="Bottom Align">⇊</button>
          </div>
          <button className="ribbon-btn" title="Wrap Text">⤾</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Number</p>
        <div className="ribbon-controls">
          <select className="ribbon-input" defaultValue="General">
            <option>General</option>
            <option>Number</option>
            <option>Currency</option>
            <option>Accounting</option>
            <option>Short Date</option>
            <option>Long Date</option>
            <option>Time</option>
            <option>Percentage</option>
            <option>Fraction</option>
            <option>Scientific</option>
            <option>Text</option>
          </select>
          <div className="button-group">
            <button className="ribbon-btn" title="Increase Decimals">.0→</button>
            <button className="ribbon-btn" title="Decrease Decimals">←.0</button>
          </div>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Cells</p>
        <div className="ribbon-controls">
          <button className="btn">Insert</button>
          <button className="btn">Delete</button>
          <button className="btn">Format</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Editing</p>
        <div className="ribbon-controls">
          <button className="btn">AutoSum</button>
          <button className="btn">Fill</button>
          <button className="btn">Clear</button>
          <div className="button-group">
            <IconButton
              icon="SortAsc"
              tooltip="Sort Ascending (A to Z)"
              onClick={() => selectedCell && sortColumn(selectedCell.col, true)}
            />
            <IconButton
              icon="SortDesc"
              tooltip="Sort Descending (Z to A)"
              onClick={() => selectedCell && sortColumn(selectedCell.col, false)}
            />
          </div>
          <button className="btn">Find & Select</button>
        </div>
      </div>
    </>
  );

  const renderInsertTab = () => (
    <>
      <div className="ribbon-group">
        <p className="ribbon-title">Rows & Columns</p>
        <div className="ribbon-controls">
          <button
            className="btn"
            onClick={() => selectedCell && insertRow(selectedCell.row)}
          >
            Insert Row
          </button>
          <button
            className="btn"
            onClick={() => selectedCell && deleteRow(selectedCell.row)}
          >
            Delete Row
          </button>
          <button
            className="btn"
            onClick={() => selectedCell && insertColumn(selectedCell.col)}
          >
            Insert Column
          </button>
          <button
            className="btn"
            onClick={() => selectedCell && deleteColumn(selectedCell.col)}
          >
            Delete Column
          </button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Tables</p>
        <div className="ribbon-controls">
          <button className="btn">PivotTable</button>
          <button className="btn">Table</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Illustrations</p>
        <div className="ribbon-controls">
          <button className="btn">Pictures</button>
          <button className="btn">Shapes</button>
          <button className="btn">Icons</button>
          <button className="btn">3D Models</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Charts</p>
        <div className="ribbon-controls">
          <button className="btn">Column</button>
          <button className="btn">Line</button>
          <button className="btn">Pie</button>
          <button className="btn">Bar</button>
          <button className="btn">Scatter</button>
          <button className="btn">See All Charts</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Links</p>
        <div className="ribbon-controls">
          <button className="btn">Link</button>
          <button className="btn">Comment</button>
        </div>
      </div>
    </>
  );

  const renderFormulasTab = () => (
    <>
      <div className="ribbon-group">
        <p className="ribbon-title">Function Library</p>
        <div className="ribbon-controls">
          <button className="btn">Insert Function</button>
          <button className="btn">AutoSum</button>
          <button className="btn">Recently Used</button>
          <button className="btn">Financial</button>
          <button className="btn">Logical</button>
          <button className="btn">Text</button>
          <button className="btn">Date & Time</button>
          <button className="btn">Lookup & Reference</button>
          <button className="btn">Math & Trig</button>
          <button className="btn">More Functions</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Defined Names</p>
        <div className="ribbon-controls">
          <button className="btn">Name Manager</button>
          <button className="btn">Define Name</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Formula Auditing</p>
        <div className="ribbon-controls">
          <button className="btn">Trace Precedents</button>
          <button className="btn">Trace Dependents</button>
          <button className="btn">Show Formulas</button>
          <button className="btn">Error Checking</button>
        </div>
      </div>
    </>
  );

  const renderDataTab = () => (
    <>
      <div className="ribbon-group">
        <p className="ribbon-title">Import & Export</p>
        <div className="ribbon-controls">
          <button className="btn">From Text/CSV</button>
          <button className="btn">From Web</button>
          <button className="btn">From Table/Range</button>
          <button className="btn" onClick={exportCSV}>Export to CSV</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Sort & Filter</p>
        <div className="ribbon-controls">
          <button className="btn">Sort A to Z</button>
          <button className="btn">Sort Z to A</button>
          <button className="btn">Filter</button>
          <button className="btn">Clear</button>
          <button className="btn">Reapply</button>
          <button className="btn">Advanced</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Data Tools</p>
        <div className="ribbon-controls">
          <button className="btn">Text to Columns</button>
          <button className="btn">Remove Duplicates</button>
          <button className="btn">Data Validation</button>
          <button className="btn">Consolidate</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Outline</p>
        <div className="ribbon-controls">
          <button className="btn">Group</button>
          <button className="btn">Ungroup</button>
          <button className="btn">Subtotal</button>
        </div>
      </div>
    </>
  );

  const renderAutomationTab = () => (
    <>
      <div className="ribbon-group">
        <p className="ribbon-title">Automation</p>
        <AutomationPanel />
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Parameters</p>
        <ParameterPanel />
      </div>
    </>
  );

  const renderGraphingTab = () => (
    <>
      <div className="ribbon-group">
        <p className="ribbon-title">Graph Settings</p>
        <div className="ribbon-controls">
          <button className="btn">Add Graph</button>
          <button className="btn">Edit Graph</button>
          <button className="btn">Remove Graph</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Graph Types</p>
        <div className="ribbon-controls">
          <button className="btn">Function</button>
          <button className="btn">Parametric</button>
          <button className="btn">Implicit</button>
          <button className="btn">Scatter</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Parameters</p>
        <div className="ribbon-controls">
          <button className="btn" disabled={!selectedCell}>
            Make Parameter from Selection
          </button>
        </div>
      </div>
    </>
  );

  const renderReviewTab = () => (
    <>
      <div className="ribbon-group">
        <p className="ribbon-title">Proofing</p>
        <div className="ribbon-controls">
          <button className="btn">Spelling</button>
          <button className="btn">Thesaurus</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Comments</p>
        <div className="ribbon-controls">
          <button className="btn">New Comment</button>
          <button className="btn">Delete</button>
          <button className="btn">Previous</button>
          <button className="btn">Next</button>
          <button className="btn">Show All</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Protect</p>
        <div className="ribbon-controls">
          <button className="btn">Protect Sheet</button>
          <button className="btn">Protect Workbook</button>
        </div>
      </div>
    </>
  );

  const renderViewTab = () => (
    <>
      <div className="ribbon-group">
        <p className="ribbon-title">Theme</p>
        <div className="ribbon-controls">
          <select
            className="ribbon-input"
            value={localTheme}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleThemeChange(e.target.value as Theme)}
            style={{ width: '180px' }}
          >
            <option value="default">Default</option>
            <option value="pastel-yellow">Pastel Yellow</option>
            <option value="pastel-blue">Pastel Blue</option>
            <option value="pastel-brown">Pastel Brown</option>
            <option value="pastel-red">Pastel Red</option>
            <option value="pastel-pink">Pastel Pink</option>
            <option value="pastel-green">Pastel Green</option>
            <option value="pastel-purple">Pastel Purple</option>
          </select>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Workbook Views</p>
        <div className="ribbon-controls">
          <button className="btn">Normal</button>
          <button className="btn">Page Break Preview</button>
          <button className="btn">Page Layout</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Show</p>
        <div className="ribbon-controls">
          <label>
            <input type="checkbox" defaultChecked /> Ruler
          </label>
          <label>
            <input type="checkbox" defaultChecked /> Gridlines
          </label>
          <label>
            <input type="checkbox" defaultChecked /> Formula Bar
          </label>
          <label>
            <input type="checkbox" defaultChecked /> Headings
          </label>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Zoom</p>
        <div className="ribbon-controls">
          <button className="btn">Zoom</button>
          <button className="btn">100%</button>
          <button className="btn">Zoom to Selection</button>
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Window</p>
        <div className="ribbon-controls">
          <button className="btn">Freeze Panes</button>
          <button className="btn">Split</button>
        </div>
      </div>
    </>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'Home':
        return renderHomeTab();
      case 'Insert':
        return renderInsertTab();
      case 'Formulas':
        return renderFormulasTab();
      case 'Data':
        return renderDataTab();
      case 'Automation':
        return renderAutomationTab();
      case 'Graphing':
        return renderGraphingTab();
      case 'Review':
        return renderReviewTab();
      case 'View':
        return renderViewTab();
      default:
        return <div className="ribbon-group"><p>Coming soon...</p></div>;
    }
  };

  return (
    <>
      <div className="ribbon-tabs">
        {(['Home', 'Insert', 'Page Layout', 'Formulas', 'Data', 'Automation', 'Graphing', 'Review', 'View'] as TabName[]).map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="ribbon">
        {renderActiveTab()}
      </div>
    </>
  );
};
