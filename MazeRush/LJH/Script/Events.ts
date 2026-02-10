import { NetworkEvent, serializable } from 'meta/worlds';

@serializable()
export class HitReactPayload {
  readonly swingId: number = 0; // 중복 방지용(펀치 1회 식별)
  readonly sentAtMs: number = 0; // 공격자 로컬 timestamp
  readonly hitOffsetMs: number = 180; // 펀치 시작 후 몇 ms에 맞는 타이밍인지
  readonly reaction: string = 'punch'; // 'punch', 'upper', 'kick' 등 연출 분기용

  constructor(swingId: number = 0, sentAtMs: number = 0, hitOffsetMs: number = 180, reaction: string = 'punch') {
    this.swingId = swingId;
    this.sentAtMs = sentAtMs;
    this.hitOffsetMs = hitOffsetMs;
    this.reaction = reaction;
  }
}

export const HitReactEvent = new NetworkEvent<HitReactPayload>('com.yourgame.hitReact', HitReactPayload);
