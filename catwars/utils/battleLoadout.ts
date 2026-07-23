import { Building, BuildingType, BuildingStatus, BattleLoadout } from '../types';

export function computeBattleLoadout(buildings: Building[]): BattleLoadout {
  const active = (type: BuildingType) =>
    buildings.some(b => b.type === type && b.status === BuildingStatus.ACTIVE);
  const count = (type: BuildingType) => buildings.filter(b => b.type === type).length;

  const hasBarracks = active(BuildingType.BARRACKS);
  const armyCampCount = count(BuildingType.ARMY_CAMP);
  const hasCannon = active(BuildingType.CANNON);
  const hasTesla = active(BuildingType.HIDDEN_TESLA);
  const wallCount = count(BuildingType.WALL);

  const unlockedTroopTypes = ['barbarian', 'giant'];
  if (hasBarracks) unlockedTroopTypes.push('archer');

  const availableBuildingTypes: BuildingType[] = [BuildingType.WALL];
  if (hasCannon) availableBuildingTypes.push(BuildingType.CANNON);
  if (hasTesla) availableBuildingTypes.push(BuildingType.HIDDEN_TESLA);

  return {
    unlockedTroopTypes,
    maxBuildingSlots: 2 + armyCampCount * 2,
    canBringCannon: hasCannon,
    canBringTesla: hasTesla,
    maxWallSlots: Math.min(wallCount, 5),
    healCharges: 2,
    rageCharges: 2,
    availableBuildingTypes,
  };
}
