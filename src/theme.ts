import { alpha, createTheme } from '@mui/material/styles';

/**
 * ROSMS visual language — "campus ledger".
 * Warm ivory paper, deep RGUKT maroon, ochre gold and warm charcoal ink.
 * Editorial serif (Newsreader) for titles, Plus Jakarta Sans for the working UI.
 */
export const palette = {
  canvas: '#F7F4EE',
  canvasSoft: '#FAF8F4',
  paper: '#FFFFFF',
  border: '#E5DFD3',
  borderStrong: '#D6CEBE',
  maroon: '#7A1F2B',
  maroonDeep: '#5E1620',
  maroonInk: '#3F0F16',
  ochre: '#B87D2B',
  ochreSoft: '#F4E7D2',
  ink: '#1F1B18',
  stone: '#5F5850',
  stoneLight: '#8A8279',
  forest: '#1F6B48',
  rust: '#B42318',
  amber: '#A66315',
};

export const serif = '"Newsreader", "Source Serif 4", Georgia, "Times New Roman", serif';
export const sans = '"Plus Jakarta Sans", "DM Sans", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const theme = createTheme({
  palette: {
    primary: { main: palette.maroon, dark: palette.maroonDeep, light: '#9A3C47', contrastText: '#FFFFFF' },
    secondary: { main: palette.ochre, dark: '#8F5F1C', light: '#D3A15A', contrastText: '#FFFFFF' },
    success: { main: palette.forest },
    error: { main: palette.rust },
    warning: { main: palette.amber },
    info: { main: '#34506B' },
    background: { default: palette.canvas, paper: palette.paper },
    text: { primary: palette.ink, secondary: palette.stone },
    divider: palette.border,
    action: { selected: alpha(palette.maroon, 0.08), hover: alpha(palette.ink, 0.04) },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: sans,
    fontSize: 14,
    h1: { fontFamily: serif, fontWeight: 600, letterSpacing: '-0.02em' },
    h2: { fontFamily: serif, fontWeight: 600, letterSpacing: '-0.02em' },
    h3: { fontFamily: serif, fontWeight: 600, letterSpacing: '-0.015em' },
    h4: { fontFamily: serif, fontWeight: 600, letterSpacing: '-0.01em' },
    h5: { fontFamily: serif, fontWeight: 600, letterSpacing: '-0.005em' },
    h6: { fontWeight: 700, fontSize: '1.02rem' },
    subtitle2: { fontWeight: 700 },
    overline: { fontWeight: 700, letterSpacing: '0.14em', fontSize: '0.68rem' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: palette.canvas, WebkitFontSmoothing: 'antialiased' },
        '::selection': { background: alpha(palette.ochre, 0.3) },
      },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderColor: palette.border, boxShadow: '0 1px 2px rgba(31,27,24,.04)' } },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: { borderColor: palette.border },
        elevation1: { boxShadow: '0 1px 2px rgba(31,27,24,.05), 0 4px 16px rgba(31,27,24,.04)' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, paddingInline: 16 },
        containedPrimary: { '&:hover': { backgroundColor: palette.maroonDeep } },
        outlined: { borderColor: palette.borderStrong, '&:hover': { borderColor: palette.maroon, backgroundColor: alpha(palette.maroon, 0.04) } },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 6 } } },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: palette.border },
        head: {
          fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase',
          color: palette.stone, background: '#F3EFE7',
        },
      },
    },
    MuiTableRow: { styleOverrides: { root: { '&.MuiTableRow-hover:hover': { backgroundColor: '#FBF8F2' } } } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: palette.paper,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderStrong },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: palette.stoneLight },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, marginInline: 8, marginBlock: 1,
          '&.Mui-selected': {
            backgroundColor: alpha(palette.maroon, 0.08), color: palette.maroon,
            '& .MuiListItemText-primary': { fontWeight: 700 },
            '&:hover': { backgroundColor: alpha(palette.maroon, 0.12) },
          },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 38, color: palette.stone, '& svg': { fontSize: 20 } } } },
    MuiListSubheader: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent', color: palette.stoneLight, fontSize: '0.68rem', fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', paddingLeft: 24,
        },
      },
    },
    MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 3, backgroundColor: palette.ochre } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, '&.Mui-selected': { color: palette.maroon } } } },
    MuiDialogTitle: { styleOverrides: { root: { fontFamily: serif, fontWeight: 600, fontSize: '1.35rem' } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: palette.ink, fontSize: '0.75rem' } } },
  },
});
