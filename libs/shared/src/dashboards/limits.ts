/** The most dashboards (tabs) one user can keep per game. */
export const MAX_DASHBOARDS = 10;

/** The most panels one dashboard can hold. */
export const MAX_PANELS = 24;

/** The most blocks one panel can hold. */
export const MAX_BLOCKS = 12;

/** The width of the panel grid, in columns. */
export const GRID_COLUMNS = 12;

/** The tallest a panel can be, in grid rows. */
export const MAX_PANEL_ROWS = 40;

/** The lowest row a panel can start in: enough for a full dashboard stacked end to end. */
export const MAX_PANEL_Y = MAX_PANELS * MAX_PANEL_ROWS;

/** The unit panel heights are counted in: a panel `h` rows tall is `h * GRID_ROW_PX + (h - 1) * GRID_GAP_PX` pixels. */
export const GRID_ROW_PX = 24;

/** The space between panels, in pixels. */
export const GRID_GAP_PX = 16;
