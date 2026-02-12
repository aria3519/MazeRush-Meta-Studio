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
  Vec3,
  SpawnPointComponent,
  type RayCastInput,
  VfxComponent,
  type EventSubscription,
  Quaternion,
} from 'meta/worlds';
import { type Entity as IEntity } from 'meta/worlds';
import { type Asset as IAsset} from 'meta/worlds';
import { HitReactEvent, HitReactPayload } from './Events';
import * as con from './Constants';
import { EffectList, EffectManager } from './EffectManager';
import { SoundManager, CustomSoundList, SoundList } from './SoundManager';
import { DisruptorManager, DisruptorType } from './DisruptorManager';

export enum PlayerState {
  Idle = 'Idle',
  Hiding = 'Hiding',
  Dead = 'Dead',
}

export enum CalculateOption {
  Equal,
  Add,
}

export enum Buff {
  SpeedUp,
  JumpSpeedUp,
}

export enum LocomotionChannel {
  Water,
  UFO,
  Slower,
}

export enum JumpChannel {
  Water,
  UFO,
  Slower,
  Glass,
}

type ResultData = {
  player: PlayerComponent;
  rank: number;
  pos: number;
};

export let playerState: PlayerState = PlayerState.Idle;

export const playerLocomotionSpeed: number = 4.5;
export const playerJumpSpeed: number = 4.3;
export const playerGravity: number = 9.81;

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

  @property() private playerManagerProxy!: IEntity;
  @property() private distruptorManager!: IEntity;
  @property() private petManager!: IEntity;
  @property() private myDoor!: IEntity;
  @property() private startPosition!: IEntity;
  @property() private maxHp: number = 100;
  @property() private gravitationalInteractingDisntace: number = 5;
  @property() private gravitationalInteractingOffset: Vec3 = Vec3.up.mul(0.5);
  @property() private raycaster!: IEntity;
  @property() private startPos: Vec3 = Vec3.zero;
  @property() private endPos: Vec3 = Vec3.zero;

  @property() private petPooling: readonly IEntity[] = [];
  @property() private petSocket!: IEntity;
  @property() private petDisntace: number = 5;
  @property() private petOffset: Vec3 = Vec3.up.mul(0.5);

  @property() private Eff_HealthUpsParent!: IEntity;
  @property() private Eff_HealthUps!: IEntity;

  currentMaxHp: number = 100;
  currentHp: number = 100;

  destination!: SpawnPointComponent;

  buff: Buff[] = [];

  noDamage: boolean = true;

  private gravitationalInteracting: boolean = false;
  private gravitationalItem!: IEntity | null;
  private gravitationalItemTransform!: TransformComponent | null;

  private knockbackCoolDown: number = 1;

  private locomotionChannels: number[] = [];
  private jumpChannels: number[] = [];

  private Button1!: PlayerInputAction;
  private Button2!: PlayerInputAction;

  private raycastGizmo!: RayCastInput;

  private testMissleBuffer = 0;
  private UFOCount = 0;

  private petPool: IEntity[] = [];
  private petEntity: IEntity | undefined = undefined;
  private currentPetType: con.PetType = con.PetType.Unarmed;

  private immuneTime: number = 0;

  private checkMyDoor = false;

  private baseMaxHp = 100;
  private baseMaxHp_max = 999999;

  private campfireBuffAmount: number = 0;
  private campfireBuffAmount_max: number = 10;

  private eff_HealthUps_Active: boolean = false;

  private eventSubscriptions: EventSubscription[] = [];

  private HealthUps!: VfxComponent | null;

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

  private OnPlayerEnterAFK(player: PlayerComponent) {
    if(this.petEntity)
    {
      this.petEntity.enabledSelf = false;
    }
  }

  private OnPlayerExitAFK(player: PlayerComponent) {
    if(this.petEntity)
    {
      this.petEntity.enabledSelf = true;
    }
  }

  private OnPlayerExitWorld(player: PlayerComponent) {
    if(this.petEntity)
    {
      this.petEntity.enabledSelf = false;
      this.petEntity = undefined;
    }
  }

  private SetUFOCount(value: number) {
    this.UFOCount = value;
    //this.sendNetworkEvent(scriptOwner, Events.UpdateQuickSlot, { player: this.world.getLocalPlayer(), slotNumber: 3, count: this.UFOCount });
  }

  private UseTestItem(player: PlayerComponent, value: number, type: DisruptorType) 
  {
    let rankList: PlayerComponent[] | undefined = this.SortPlayers();

    if (value < 0 && !rankList) return;

    switch (type) {
      case DisruptorType.Missile: {
        if (value < 0) {
          if (this.testMissleBuffer > 0) {
            if (this.distruptorManager) {
              /*
              this.sendNetworkBroadcastEvent(Events.updateDisruptorManager, {
                type: DisruptorType.Missile,
                startPosition: this.world.getLocalPlayer().position.get().add(this.world.getLocalPlayer().forward.get().mul(0.5)),
                startRotation: hz.Quaternion.zero,
                rank: 0,
              });
              */
            }

            this.testMissleBuffer += value;
          }
        } else this.testMissleBuffer += value;

        break;
      }
      case DisruptorType.UFO: {
        if (value < 0) {
          if (this.UFOCount > 0) {
            if (this.distruptorManager) {
              /*
              this.sendNetworkBroadcastEvent(Events.updateDisruptorManager, {
                type: DisruptorType.UFO,
                startPosition: this.world.getLocalPlayer().position.get().add(this.world.getLocalPlayer().forward.get().mul(0.5)),
                startRotation: hz.Quaternion.zero,
                rank: 0,
              });
              */
            }

            this.SetUFOCount(this.UFOCount + value);
          }
        } else {
          this.SetUFOCount(this.UFOCount + value);
        }

        break;
      }
    }
  }

  private SortPlayers(): PlayerComponent[] {
    let allPlayersData = new Map<number, ResultData>();
    /*
    const players = this.world.getPlayers();
    const startPos: Vec3 = this.startPos;
    const endPos: Vec3 = this.endPos;

    players.forEach(player => {
      try {
        if (player !== this.world.getServerPlayer()) {
          if (!allPlayersData.has(player.id)) {
            const playerPos = player.position.get();
            const startMag = playerPos.sub(startPos).magnitude();
            const endMag = playerPos.sub(endPos).magnitude();
            let pos = startMag / (startMag + endMag);

            if (playerPos.z <= startPos.z) {
              pos = 0;
            } else if (playerPos.z >= endPos.z) {
              pos = 1;
            }

            allPlayersData.set(player.id, {
              player: player,
              rank: 0,
              pos: pos,
            });
          }
        }
      } catch (error) {
        return undefined;
      }
    });
    */
    let sortedPlayers = Array.from(allPlayersData.values())
      .sort((a, b) => b.pos - a.pos)
      .map(data => data.player);

    return sortedPlayers;
  }

  private PlayerGetMaxHp(): number {
    return this.currentMaxHp;
  }

  private PlayerGetHp(): number {
    return this.currentHp;
  }

  private PlayerSetHp(value: number, player: PlayerComponent): void {
    this.currentHp = Math.max(0, value);
  }

  private PlayerSetMaxHp(value: number, player: PlayerComponent, setHpMax: boolean, option: CalculateOption, isCampfireBuff: boolean = false): void {
    if (isCampfireBuff) {
      switch (option) {
        case CalculateOption.Equal:
          this.campfireBuffAmount = value;
          break;
        case CalculateOption.Add:
          this.campfireBuffAmount += value;
          break;
        default:
          this.campfireBuffAmount = value;
          break;
      }

      this.campfireBuffAmount = Math.min(this.campfireBuffAmount, this.campfireBuffAmount_max);
      this.campfireBuffAmount = Math.max(this.campfireBuffAmount, 0);
    } else {
      switch (option) {
        case CalculateOption.Equal:
          this.baseMaxHp = value;
          break;
        case CalculateOption.Add:
          this.baseMaxHp += value;
          break;
        default:
          this.baseMaxHp = value;
          break;
      }

      this.baseMaxHp = Math.min(this.baseMaxHp, this.baseMaxHp_max);
      this.baseMaxHp = Math.max(this.baseMaxHp, 0);
    }

    let percent = this.currentHp / this.currentMaxHp;

    this.currentMaxHp = this.baseMaxHp + this.campfireBuffAmount;

    if (setHpMax) {
      this.currentHp = this.currentMaxHp;
    } else {
      this.currentHp = this.currentMaxHp * percent;

      /*
      this.sendLocalEvent(player, Events.UIChangeEvent, {
        player: player,
        hp: this.currentHp,
        maxHp: this.currentMaxHp,
        damage: 0,
        useEffect: false,
        isCampfireBuff: isCampfireBuff,
        campfireBuffAmount: this.campfireBuffAmount,
      });
      */
    }
  }

  private PlayerHit(damage: number, player: PlayerComponent, force: Vec3, playVFX: boolean, killer: string, weapon: string): void {
    if (playerState === PlayerState.Dead || this.immuneTime < 0) return;

    this.currentHp = Math.max(0, this.PlayerGetHp() - damage);

    if (damage > 0) {
      this.noDamage = false;
    }

    if (this.PlayerGetHp() <= 0) {
      this.Dead(player);
      this.Analytics_Dead(killer, weapon);
    } else {
      if (this.knockbackCoolDown >= 0.2) {
        this.knockbackCoolDown = 0;
        if (this.locomotionChannels[LocomotionChannel.UFO] > 0) {
          player.addVelocity(force);
        }
      }

      let transform : TransformComponent | null = player.entity.getComponent(TransformComponent);
      if (playVFX && transform != null) this.PlayVFX(transform.worldPosition, EffectList.FireImpact_A);

      //player..leftHand.playHaptics(200, HapticStrength.Medium, HapticSharpness.Sharp);
      //player.rightHand.playHaptics(200, HapticStrength.Medium, HapticSharpness.Sharp);

      if(transform != null)
      {
        /*
        this.PlayCustomSoundWithAudioOption(
          transform.worldPosition,
          CustomSoundList.Player_Oof,
          0.8,
          0,
          0,
          [this.world.getLocalPlayer()],
          hz.AudibilityMode.AudibleTo
        );
        */
      }
    }

    let hp: number = this.currentHp;
    let maxHp: number = this.PlayerGetMaxHp();

    /*
    this.sendLocalEvent(player, Events.UIChangeEvent, {
      player,
      hp,
      maxHp,
      damage: -damage,
      useEffect: false,
      isCampfireBuff: false,
      campfireBuffAmount: this.campfireBuffAmount,
    });
    */
  }

  private PlayerHeal(heal: number, player: PlayerComponent, useEffect: boolean, forceToHeal: boolean = false): void {
    if (!forceToHeal && playerState === PlayerState.Dead) return;

    let previousHp = this.currentHp;
    this.currentHp = Math.min(this.PlayerGetMaxHp(), this.PlayerGetHp() + heal);

    let hp: number = this.currentHp;
    let maxHp: number = this.PlayerGetMaxHp();

    /*
    this.sendLocalEvent(player, Events.UIChangeEvent, {
      player,
      hp,
      maxHp,
      damage: heal,
      useEffect: useEffect,
      isCampfireBuff: false,
      campfireBuffAmount: this.campfireBuffAmount,
    });
    */

    //if (this.petEntity) this.sendNetworkEvent(this.petEntity, Events.playerHealCallbackEvent, { heal: this.currentHp - previousHp, player: player });
  }

  private Initialize(): void {
    this.currentMaxHp = this.maxHp;
    this.currentHp = this.currentMaxHp;
    this.HealthUps = this.Eff_HealthUps.getComponent(VfxComponent);

    for (let i = 0; i < 256; ++i) {
      this.locomotionChannels.push(1);
      this.jumpChannels.push(1);
    }
  }

  private BuffIconUpdate(buff: Buff, isActive: boolean): void {
    let buffIconID: Buff[] = [];

    if (isActive) {
      let alreadyActive = false;

      for (let i = 0; i < this.buff.length; ++i) {
        if (this.buff[i] === buff) {
          alreadyActive = true;
        }

        buffIconID.push(this.buff[i]);
      }

      if (!alreadyActive) {
        buffIconID.push(buff);
        this.buff.push(buff);
      }
    } else {
      for (let i = 0; i < this.buff.length; ++i) {
        if (this.buff[i] !== buff) {
          buffIconID.push(this.buff[i]);
        }
      }

      this.buff = buffIconID;
    }

    //let scriptOwner: PlayerComponent = this.entity.owner.get();
    //if (scriptOwner !== this.world.getServerPlayer()) this.sendNetworkEvent(scriptOwner, Events.buffIconUpdate, { buffIconID });
  }

  private EraseAllBuffIcon() {
    let buffIconID: Buff[] = [];

    while (this.buff.length > 0) {
      this.buff.pop();
    }

    //let scriptOwner: PlayerComponent = this.entity.owner.get();
    //if (scriptOwner !== this.world.getServerPlayer()) this.sendNetworkEvent(scriptOwner, Events.buffIconUpdate, { buffIconID });
  }

  private InitializeDatumForPlayerAchivements(player: PlayerComponent) {
    this.noDamage = true;
  }

  private UpdateDatumForPlayerAchivements(player: PlayerComponent) {
    if (this.noDamage) {
      /*
      if (this.spawnManager)
     
        this.sendNetworkEvent(this.spawnManager, Events.updateAchivement, {
          player: player,
          questID: con.Quest_010,
        });
      */
    }
  }

  private StartGravitationalInteraction(player: PlayerComponent, item: IEntity, index: number) {
    if (this.gravitationalInteracting && this.gravitationalItem && this.gravitationalItemTransform != null) {
      this.EndGravitationalInteraction(this.gravitationalItem, this.gravitationalItemTransform.worldRotation.toEuler());
    }

    this.gravitationalInteracting = true;
    this.gravitationalItem = item;
    this.gravitationalItemTransform = item.getComponent(TransformComponent);

    this.SetItemGravity(item, false, Vec3.zero);

    if(this.gravitationalItemTransform)
      this.PlaySound(this.gravitationalItemTransform.worldPosition, SoundList.ButtonClick, 1);
    //this.sendNetworkBroadcastEvent(Events.updateGravitationalInteractionEvent, { player: player, item: item, index: index });
  }

  private UpdateGravitationalInteraction() {
    if (!this.gravitationalInteracting) return;

    if (this.gravitationalItem) {
      /*
      this.gravitationalItem.worldPosition.set(
        LocalCamera.position
          .get()
          .add(LocalCamera.forward.get().mul(this.props.gravitationalInteractingDisntace).add(this.props.gravitationalInteractingOffset))
      );
      */
    }
  }

  private EndGravitationalInteraction(item: IEntity, settingRotation: Vec3) {
    this.gravitationalInteracting = false;

    let force: Vec3 = Vec3.zero;

    /*
    if (this.raycastGizmo) {
      const basePos = LocalCamera.position.get().add(LocalCamera.forward.get());
      const raycastDirection = LocalCamera.forward.get();
      const maxDistance = 10;
      const result = this.raycastGizmo.raycast(basePos, raycastDirection, {
        maxDistance,
      });

      if (result) {
        item.worldRotation = Quaternion.fromEuler(Vec3.right.mul(270));
        item.worldPosition = result.hitPoint;
        this.PlaySound(item.worldPosition, SoundList.ButtonClick, 1);
      } else {
        force = LocalCamera.forward.get().mul(10);
        this.PlaySound(item.transform.position.get(), SoundList.BowShoot, 1);
      }
    } else {
      force = LocalCamera.forward.get().mul(10);
      this.PlaySound(item.transform.position.get(), SoundList.BowShoot, 1);
    }
    */

    this.SetItemGravity(item, true, force);

    this.gravitationalItem = null;
  }

  private SetItemGravity(item: IEntity, value: boolean, force: Vec3) {
    let physics: PhysicsBodyComponent | null = item.getComponent(PhysicsBodyComponent);
    if (physics != null) {
      //physics.gravityEnabled.set(value);
      physics.linearVelocity = Vec3.zero;

      if (force != Vec3.zero) {
      physics.applyForce(force);
    }
    }
  }

  private SetPet(player: PlayerComponent, petType: con.PetType) {
    for(let i = 0; i < this.petPool.length; ++i)
    {
      this.petPool[i].enabledSelf = false;
    }

    this.currentPetType = petType;
    this.petEntity = this.petPool[this.currentPetType - 1];
    this.petEntity.enabledSelf = true;
  }

  private RemoveCurrentPet(player: PlayerComponent) {
    for(let i = 0; i < this.petPool.length; ++i)
    {
      this.petPool[i].enabledSelf = false;
    }

    if(this.petEntity)
    {
      this.petEntity = undefined;
    }
  }

  private UpdatePetSocket() {
    if (this.petSocket) {
      /*
      let player: PlayerComponent = this.world.getLocalPlayer();
      let offset: Vec3 = Vec3.zero;
      let right: Vec3 = Vec3.cross(LocalCamera.up.get(), LocalCamera.forward.get());
      offset = offset.add(right.mul(this.props.petOffset.x));
      offset = offset.add(LocalCamera.up.get().mul(this.props.petOffset.y));
      offset = offset.add(LocalCamera.forward.get().mul(this.props.petOffset.z));
      this.props.petSocket.position.set(player.position.get().add(offset));
      this.props.petSocket.rotation.set(player.rotation.get());
      */
    }
  }

  private SetEffect(on: boolean) {
    if (on && !this.eff_HealthUps_Active) this.HealthUps?.play();
    else if (!on && this.eff_HealthUps_Active) this.HealthUps?.stop();

    this.eff_HealthUps_Active = on;
  }

  private RequestMazeNodeInformation() {
    /*
    if (this.world.getLocalPlayer() !== this.world.getServerPlayer() && this.props.playerManagerProxy)
      this.sendNetworkEvent(this.props.playerManagerProxy, Events.requestMazeNodeInformationEvent, {
        playerPosition: this.world.getLocalPlayer().position.get(),
        player: this.world.getLocalPlayer(),
      });
    */
  }

  private ReceiveMazeNodeInformation(cameraDistance: number) {
    //LocalCamera.overrideCameraFarClipPlane(cameraDistance);
  }

  public Dead(player: PlayerComponent): void {
    this.ChangeState(player, PlayerState.Dead);

    //if (this.spawnManager) this.sendNetworkEvent(this.spawnManager, Events.DropGunEvent, { player: player, isReset: true });

    //player.playAvatarGripPoseAnimationByName('Die');

    /*
    this.sendNetworkBroadcastEvent(Events.playerStateEvent, {
      player: player,
      state: playerState,
    });
    */

    /*
    this.PlayCustomSoundWithAudioOption(
      player.position.get(),
      CustomSoundList.Player_Death,
      0.8,
      0,
      0,
      [this.world.getLocalPlayer()],
      hz.AudibilityMode.AudibleTo
    );
    */

    //player.gravity.set(9.81);
    this.SetUFOCount(0);

    /*
    this.async.setTimeout(() => {
      if (this.props.startPosition && this.entity.owner.get().id === player.id && player !== this.world.getServerPlayer())
        this.destination?.teleportPlayer(player);

      this.async.setTimeout(() => {
        if (this.props.startPosition && this.entity.owner.get().id === player.id) player.playAvatarGripPoseAnimationByName('Respawn');

        if (this.campfireBuffAmount > 0) {
          this.PlayerSetMaxHp(0, player, true, CalculateOption.Equal, true);
        }

        this.InitializePlayer(player);
        this.SetImmune(3);

        this.ChangeState(player, PlayerState.Idle);
      }, 600);
    }, 3000);
    */
  }

  private SetImmune(time: number) {
    this.immuneTime = -time;
  }

  private ImmuneCount(deltaTime: number) {
    if (this.immuneTime < 0) {
      this.immuneTime += deltaTime;
    }
  }

  public ChangeState(player: PlayerComponent, state: PlayerState) {
    playerState = state;
    /*
    this.sendNetworkBroadcastEvent(Events.playerStateEvent, {
      player: player,
      state: playerState,
    });
    */
  }

  public ReplyPlayerStateRequest(player: PlayerComponent) {
    if (playerState == PlayerState.Dead) return;

    /*
    this.sendNetworkBroadcastEvent(Events.replyPlayerStateEvent, {
      player: player,
      state: playerState,
    });
    */
  }

  public LocomotionSpeedChange(player: PlayerComponent, locomotionSpeedScale: number, channel: LocomotionChannel) {
    let speed = playerLocomotionSpeed;

    this.locomotionChannels[channel] = locomotionSpeedScale;

    for (
      let i = 0;
      i < 3;
      ++i //locomotionChannel Enum 개수보다 많을 것
    ) {
      speed *= this.locomotionChannels[i];
    }

    //player.locomotionSpeed.set(speed);

    //this.BuffIconUpdate(Buff.SpeedUp, true);
  }

  public JumpSpeedChange(player: PlayerComponent, jumpSpeedScale: number, channel: JumpChannel) {
    let speed = playerJumpSpeed;

    this.jumpChannels[channel] = jumpSpeedScale;

    for (
      let i = 0;
      i < 4;
      ++i //JumpChannel Enum 개수보다 많을 것
    ) {
      speed *= this.jumpChannels[i];
    }

    //player.jumpSpeed.set(speed);

    //this.BuffIconUpdate(Buff.JumpSpeedUp, true);
  }

  public InitializePlayer(player: PlayerComponent) {
    for (let i = 0; i < this.locomotionChannels.length; ++i) this.locomotionChannels[i] = 1;

    for (let i = 0; i < this.jumpChannels.length; ++i) this.jumpChannels[i] = 1;

    //player.locomotionSpeed.set(playerLocomotionSpeed);
    //player.jumpSpeed.set(playerJumpSpeed);
    //player.gravity.set(9.81);
    this.SetUFOCount(0);

    this.PlayerHeal(this.PlayerGetMaxHp() + 1, player, false, true);

    /*
    this.sendNetworkBroadcastEvent(Events.playerInitialization, {
      player: player,
    });
    */

    //this.EraseAllBuffIcon();
  }

  public CheckExplosionCollision(pos: Vec3, damage: number, radius: number, killer: string, weapon: string) {
    /*
    const player = this.entity.owner.get();

    let dir = player.position.get().sub(pos);
    const distSq = dir.magnitudeSquared();
    if (distSq <= radius * radius) {
      dir.y = 0;
      dir = dir.normalize();
      dir.y = 0.3;
      dir = dir.normalize();
      this.PlayerHit(damage, player, dir.mul(3), false, killer, weapon);
    }
      */
  }

  private Analytics_Dead(killer: string, weapon: string) {
          /*
    if (this.playerManagerProxy)
      this.sendNetworkEvent(this.props.playerManagerProxy, Events.sendAnalytics_DeadEvent, {
        killer: killer,
        weapon: weapon,
        player: this.world.getLocalPlayer(),
      });
      */
  }

  private PlaySound(position: Vec3, type: SoundList, volume: number) {
    SoundManager.PlaySound(position, type, volume);
  }

  /*
  private PlayCustomSoundWithAudioOption(
    position: Vec3,
    type: CustomSoundList,
    volume: number,
    pitch: number,
    fade: number,
    players: PlayerComponent[] | undefined,
    mode: AudibilityMode
  ) {
    if (this.soundManager) {
      this.sendNetworkEvent(this.soundManager, Events.playCustomSoundWithAudioOptions, {
        position: position,
        type: type,
        volume: volume,
        pitch: pitch,
        audioOption: {
          fade: fade,
          players: players,
          audibilityMode: mode,
        },
        isPlay: true,
      });
    }
  }
  */

  private PlayVFX(position: Vec3, type: EffectList) {
    EffectManager.PlayEffect(position, type);
  }

  dispose() {
    this.eventSubscriptions.forEach(sub => sub.disconnect());
  }
}
