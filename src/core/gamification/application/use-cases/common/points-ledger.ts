import { UserPoints } from "../../../domain/user-points.aggregate";
import {
  PointsSource,
  PointsSourceEnum,
} from "../../../domain/value-objects/points-source.vo";
import { ScoreTypeEnum } from "../../../domain/value-objects/score-type.vo";

export type PointsMetadata = Record<string, any> | undefined;

export function scoreTypeFromPointsSource(
  source: PointsSourceEnum,
): ScoreTypeEnum {
  switch (source) {
    case PointsSourceEnum.SCAN_QR:
      return ScoreTypeEnum.QR_SCAN;
    case PointsSourceEnum.REQUEST:
      return ScoreTypeEnum.REQUEST_SENT;
    case PointsSourceEnum.ACCEPTED_REQUEST:
      return ScoreTypeEnum.REQUEST_ACCEPTED;
    case PointsSourceEnum.TIP:
      return ScoreTypeEnum.TIP_GIVEN;
    case PointsSourceEnum.SOCIAL_SHARE:
      return ScoreTypeEnum.SOCIAL_SHARE;
    case PointsSourceEnum.BONUS:
      return ScoreTypeEnum.BONUS;
  }
}

export function resolveLedgerPoints(
  source: PointsSourceEnum,
  metadata: PointsMetadata,
): number {
  if (source === PointsSourceEnum.TIP) {
    return Number(metadata?.amount ?? 0);
  }

  if (source === PointsSourceEnum.BONUS) {
    return Number(metadata?.points ?? 0);
  }

  return PointsSource.create(source).getPointsValue();
}

export function applyPointsProjection(
  userPoints: UserPoints,
  source: PointsSourceEnum,
  metadata: PointsMetadata,
  ledgerPoints: number,
): void {
  switch (source) {
    case PointsSourceEnum.SCAN_QR:
      userPoints.scanQr();
      break;
    case PointsSourceEnum.REQUEST:
      userPoints.makeMusicRequest();
      break;
    case PointsSourceEnum.TIP:
      userPoints.sendTip(ledgerPoints);
      break;
    case PointsSourceEnum.SOCIAL_SHARE:
      userPoints.shareOnSocial();
      break;
    case PointsSourceEnum.ACCEPTED_REQUEST:
      userPoints.acceptedMusicRequest();
      break;
    case PointsSourceEnum.BONUS:
      userPoints.addPoints(ledgerPoints);
      break;
  }
}

export function getLedgerReferenceId(metadata: PointsMetadata): string | null {
  return (
    metadata?.reference_id ??
    metadata?.request_id ??
    metadata?.tip_id ??
    metadata?.event_id ??
    metadata?.musician_id ??
    metadata?.target_id ??
    null
  );
}

export function getLedgerDescription(
  source: PointsSourceEnum,
  metadata: PointsMetadata,
): string {
  return String(metadata?.description ?? `Gamification points from ${source}`);
}
