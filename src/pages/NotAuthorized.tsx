import { Box, Button, Typography } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { useNavigate } from 'react-router-dom';

export default function NotAuthorized({ message }: { message?: string }) {
  const nav = useNavigate();
  return (
    <Box sx={{ textAlign: 'center', py: 10 }}>
      <LockIcon sx={{ fontSize: 56, color: 'text.disabled' }} />
      <Typography variant="h6" sx={{ mt: 1 }}>{message ?? 'You do not have access to this module.'}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Ask a ROSMS administrator to assign it to you.</Typography>
      <Button variant="contained" onClick={() => nav('/')}>Back to dashboard</Button>
    </Box>
  );
}
