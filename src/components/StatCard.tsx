import { Card, CardContent, Stack, Typography, Box } from '@mui/material';
import type { ReactNode } from 'react';

export default function StatCard({ label, value, icon, color = '#15437f', hint }: { label: string; value: ReactNode; icon?: ReactNode; color?: string; hint?: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          {icon && (
            <Box sx={{ width: 46, height: 46, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: color + '1a', color }}>
              {icon}
            </Box>
          )}
          <Box>
            <Typography variant="h5" sx={{ lineHeight: 1.1 }}>{value}</Typography>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
