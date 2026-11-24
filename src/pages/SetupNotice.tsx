import { Alert, Box, Container, Paper, Typography } from '@mui/material';

export default function SetupNotice() {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper variant="outlined" sx={{ p: 4 }}>
        <Box component="img" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" sx={{ width: 56, mb: 2 }} />
        <Typography variant="h5" gutterBottom>ROSMS is almost ready</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>Firebase is not configured for this build yet.</Alert>
        <Typography variant="body2" color="text.secondary">
          Administrator: add the <code>VITE_FIREBASE_*</code> repository variables in GitHub (Settings → Secrets and variables →
          Actions → Variables) and re-run the “Deploy to GitHub Pages” workflow. See the README for step-by-step instructions.
        </Typography>
      </Paper>
    </Container>
  );
}
