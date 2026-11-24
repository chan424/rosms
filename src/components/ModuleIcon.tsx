import LibraryIcon from '@mui/icons-material/LocalLibrary';
import HospitalIcon from '@mui/icons-material/LocalHospital';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import ComputerIcon from '@mui/icons-material/Computer';
import MemoryIcon from '@mui/icons-material/Memory';
import BoltIcon from '@mui/icons-material/Bolt';
import SettingsIcon from '@mui/icons-material/PrecisionManufacturing';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import ConstructionIcon from '@mui/icons-material/Construction';
import ElectricalIcon from '@mui/icons-material/ElectricalServices';
import BuildIcon from '@mui/icons-material/Build';
import RouterIcon from '@mui/icons-material/Router';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import GroupsIcon from '@mui/icons-material/Groups';
import BadgeIcon from '@mui/icons-material/Badge';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import InventoryIcon from '@mui/icons-material/Inventory2';
import type { SvgIconProps } from '@mui/material';

const MAP: Record<string, typeof InventoryIcon> = {
  library: LibraryIcon, hospital: HospitalIcon, central: WarehouseIcon, cse: ComputerIcon, ece: MemoryIcon, eee: BoltIcon,
  me: SettingsIcon, ce: ArchitectureIcon, civilworks: ConstructionIcon, electricalworks: ElectricalIcon, mechworks: BuildIcon,
  itinfra: RouterIcon, fo: AccountBalanceIcon, dsw: GroupsIcon, ebs: BadgeIcon, outpass: DirectionsWalkIcon,
};

export default function ModuleIcon({ id, ...p }: { id: string } & SvgIconProps) {
  const I = MAP[id] ?? InventoryIcon;
  return <I {...p} />;
}
