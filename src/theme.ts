import { createTheme } from '@mui/material/styles';

// RGUKT-inspired palette: deep institutional blue with a warm saffron accent.
export const theme = createTheme({
  palette: {
    primary: { main: '#15437f', dark: '#0d2d57', light: '#3b6cb0' },
    secondary: { main: '#f39c12' },
    background: { default: '#f4f6fb', paper: '#ffffff' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiPaper: { styleOverrides: { outlined: { borderColor: '#e3e8f1' } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 700, background: '#f7f9fc' } } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
  },
});
