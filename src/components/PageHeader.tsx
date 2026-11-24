import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export default function PageHeader({ title, subtitle, actions, color }: { title: string; subtitle?: string; actions?: ReactNode; color?: string }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 3 }}>
      <Box sx={{ borderLeft: 5, borderColor: color ?? 'primary.main', pl: 1.5 }}>
        <Typography variant="h5">{title}</Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{actions}</Stack>}
    </Stack>
  );
}
