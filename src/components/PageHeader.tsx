import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { palette, serif } from '../theme';

export default function PageHeader({ title, subtitle, actions, color }: { title: string; subtitle?: string; actions?: ReactNode; color?: string }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }} justifyContent="space-between" sx={{ mb: 3.5, pb: 2, borderBottom: `1px solid ${palette.border}` }}>
      <Box>
        <Box aria-hidden sx={{ width: 28, height: 3, borderRadius: 2, bgcolor: color ?? palette.ochre, mb: 1.25 }} />
        <Typography component="h1" sx={{ fontFamily: serif, fontWeight: 600, fontSize: { xs: 26, md: 32 }, lineHeight: 1.1, letterSpacing: '-0.01em' }}>{title}</Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{actions}</Stack>}
    </Stack>
  );
}
