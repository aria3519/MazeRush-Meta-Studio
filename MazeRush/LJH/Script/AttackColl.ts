import { component, Component, OnEntityStartEvent, subscribe, OnTriggerEnterEvent, OnTriggerEnterEventPayload, EventService } from 'meta/worlds';
import { PlayerManager } from './PlayerManager';
import { HitReactEvent } from './Events';

@component()
export class AttackColl extends Component {
  private swingSeq = 0;
  private readonly HIT_OFFSET_MS = 100; // 펀치 시작 후 명중 프레임

  @subscribe(OnEntityStartEvent)
  onStart() {}

  @subscribe(OnTriggerEnterEvent)
  onTriggerEnter(payload: OnTriggerEnterEventPayload) {
    if (payload.actorCollider) {
      //console.log('payload.actorCollider');
      const targetEntity = payload?.actorEntity;

      if (targetEntity) {
        const swingId = ++this.swingSeq;
        const sentAtMs = Date.now();
        EventService.sendToOwner(
          HitReactEvent,
          {
            swingId,
            sentAtMs,
            hitOffsetMs: this.HIT_OFFSET_MS,
            reaction: 'punch',
          },
          targetEntity
        );
        console.log('sendToOwner');
      }

      //const manager = payload.actorCollider.getComponent(PlayerManager);

      //if (manager) {
      //console.log('manager');
      //manager.onDamage();
      //}
      //payload.actorCollider.getComponent(DamageColl)?.playerManager?.onDamage();
    }
  }
}
