import {
  OnEntityStartEvent,
  component,
  Component,
  property,
  InputVisualConfigAsset,
  OnPlayerGrabEvent,
  OnPlayerGrabEventPayload,
  OnPlayerReleaseEvent,
  OnPlayerReleaseEventPayload,
  PlayerInputAction,
  PlayerInputActionCallbackPayload,
  PlayerInputService,
  PlayerInputState,
  PlayerInputSubscription,
  type Maybe,
  subscribe,
  AvatarAnimatorComponent,
  PlayerComponent,
  AvatarVisibilityState,
  AvatarService,
  PhysicsBodyComponent,
  TransformComponent,
  OnTriggerEnterEvent,
  OnTriggerEnterEventPayload,
  EventService,
} from 'meta/worlds';
import { type Entity as IEntity } from 'meta/worlds';
import { HitReactEvent, HitReactPayload } from './Events';

@component()
export class PlayerManager extends Component {
  private primaryRightInputSubscription: Maybe<PlayerInputSubscription> = null;

  @property()
  private readonly inputVisualConfigAsset: Maybe<InputVisualConfigAsset> = null;

  @property()
  private attackEntity!: IEntity;
  private attackTransform: TransformComponent | null = null;
  private attackPhysics: PhysicsBodyComponent | null = null;

  private playerComponent: PlayerComponent | null = null;
  private avatarAnimComponent: AvatarAnimatorComponent | null = null;

  private lastSwingIdByAttackerOrGlobal = 0; // 간단 중복 방지
  private pendingTimer: any = null;

  @subscribe(OnEntityStartEvent)
  onStart() {
    console.log('onStart');
    if (this.inputVisualConfigAsset == null) {
      console.error('No input visual config asset provided');
      return;
    }

    if (this.attackEntity) {
      this.attackPhysics = this.attackEntity.getComponent(PhysicsBodyComponent);
      if (this.attackPhysics) {
        this.attackPhysics.collisionEnabled = false;
      }
      this.attackTransform = this.attackEntity.getComponent(TransformComponent);
    }

    this.playerComponent = this.entity.getComponent(PlayerComponent);
    this.avatarAnimComponent = this.entity.getComponent(AvatarAnimatorComponent);

    this.primaryRightInputSubscription = PlayerInputService.get().subscribePlayerInputAction(
      this, // Specify an owner component, if the owner is destroyed the subscription is automatically released
      PlayerInputAction.PrimaryRight, // Select which input we will subscribe to
      this.onPrimaryRightInput.bind(this), // Provide the callback function
      this.inputVisualConfigAsset // Provide the input visual config asset
    );
  }

  onPrimaryRightInput(payload: PlayerInputActionCallbackPayload) {
    if (payload.inputState === PlayerInputState.Pressed) {
      if (this.avatarAnimComponent) {
        this.avatarAnimComponent.playAnimation('Jab', { speed: 1.5 });
        if (this.attackPhysics) {
          this.attackPhysics.collisionEnabled = true;
        }
      }
      if (this.playerComponent) {
        this.playerComponent.translationEnabled = false;
        this.playerComponent.rotationEnabled = false;
      }

      // setTimeout(() => {
      //   if (this.attackEntity) {
      //     //this.attackEntity.enabledSelf = true;
      //     //this.attackTransform = this.attackEntity.getComponent(TransformComponent);
      //   }
      //   if (this.attackPhysics) {
      //     this.attackPhysics.collisionEnabled = true;
      //   }
      // }, 200);

      setTimeout(() => {
        if (this.attackEntity) {
          //this.attackEntity.enabledSelf = false;
        }
        if (this.attackPhysics) {
          this.attackPhysics.collisionEnabled = false;
        }
      }, 500);

      setTimeout(() => {
        if (this.playerComponent) {
          this.playerComponent.translationEnabled = true;
          this.playerComponent.rotationEnabled = true;
        }
      }, 1000);
      //console.log('Pressed primary right');
    } else if (payload.inputState === PlayerInputState.Released) {
      //console.log('Released primary right');
    }
  }

  onDamage() {
    console.log('onDamage');
    console.log(this.entity.isOwned());
    if (this.avatarAnimComponent) {
      this.avatarAnimComponent.playAnimation('Damage', { speed: 1 });
    }
  }

  @subscribe(HitReactEvent)
  onHitReact(payload: HitReactPayload): void {
    // 1) 중복 방지(네트워크 재전송/중복 수신 대비)
    if (payload.swingId <= this.lastSwingIdByAttackerOrGlobal) return;
    this.lastSwingIdByAttackerOrGlobal = payload.swingId;

    // 2) 타임스탬프 기반 스케줄링
    const now = Date.now();
    const elapsed = now - payload.sentAtMs; // 이벤트가 늦게 온 만큼 elapsed가 커짐
    const remaining = payload.hitOffsetMs - elapsed; // 아직 명중 타이밍 전이면 남은 시간만 기다림

    // 기존 타이머가 있으면 취소(연속 피격 처리 정책은 너가 선택)
    if (this.pendingTimer != null) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }

    if (remaining <= 0) {
      // 이미 명중 타이밍은 지남 → 즉시 피격 애니
      this.onDamage();
    } else {
      // 남은 시간만큼만 대기 후 피격 애니
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null;
        this.onDamage();
      }, remaining);
    }
  }

  @subscribe(OnTriggerEnterEvent)
  onTriggerEnter(payload: OnTriggerEnterEventPayload) {
    if (payload.actorCollider) {
      //console.log('payload.actorCollider');
      //this.onDamage();
      //payload.actorCollider.getComponent(DamageColl)?.playerManager?.onDamage();
    }
  }
}
