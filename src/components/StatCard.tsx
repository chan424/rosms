import { Card, CardContent, Stack, Typography, Box } from '@mui/material';
import type { ReactNode } from 'react';
import { palette, serif } from '../theme';

export default function StatCard({ label, value, icon, color = palette.maroon, hint }: { label: string; value: ReactNode; icon?: ReactNode; color?: string; hint?: string }) {
  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden', transition: 'border-color .15s, box-shadow .15s', '&:hover': { borderColor: palette.borderStrong, boxShadow: '0 4px 18px rgba(31,27,24,.06)' } }}>
      <Box aria-hidden sx={{ position: 'absolute', left: 0, top: 16, bottom: 16, width: 3, borderRadius: '0 3px 3px 0', bgcolor: color }} />
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 12.5, mb: 0.75 }}>{label}</Typography>
            <Typography sx={{ fontFamily: serif, fontWeight: 600, fontSize: { xs: 26, md: 30 }, lineHeight: 1, color: palette.ink, fontVariantNumeric: 'lining-nums tabular-nums' }}>{value}</Typography>
            {hint && <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>{hint}</Typography>}
          </Box>
          {icon && (
            <Box sx={{ width: 38, height: 38, flexShrink: 0, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: color + '14', color, '& svg': { fontSize: 20 } }}>
              {icon}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
