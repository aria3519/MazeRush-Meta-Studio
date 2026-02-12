import { property, component, Component, OnEntityStartEvent, subscribe, Vec3, AudioService, SoundComponent, SoundPlayInfo, TransformComponent} from 'meta/worlds';
import { type Entity as IEntity } from 'meta/worlds';
import * as Events from './Events';

export enum SoundList {
  BulletHitSFX,
  WeaponLaserSwordHit,
  Explosion1,
  BowShoot,
  BucketDump,
  AirBoostEnd02Short,
  WoodBreak,
  BreachWaterSplash,
  MonsterDieRandom,
  MoneyCoins,
  BigSplash,
  TrashDrop1,
  Use_PathFinder,
  MonsterRoarRandom,
  ButtonClick,
  GameTeleport,
  GameTeleportSciFi,
  MonsterScream,
}

export enum CustomSoundList {
  DefaultBGM,
  CombatBGM,
  BulletHitSFX_Spark,
  BulletHitSFX_Spark2,
  BulletHitSFX_Explosion,
  BulletHitSFX_Explosion2,
  BulletHitSFX_WaterExplosion,
  BulletHitSFX_LightExplosion,
  BulletHitSFX_Funny,
  BulletHitSFX_Fire,
  BulletHitSFX_Sword,
  BulletHitSFX_Sword2,
  BulletHitSFX_Sword3,
  MonsterAttack,
  OpenDoorSound,
  TreasureChestCreaksOpen,
  Use_HealthPotion,
  RobotRoar,
  RobotCrushing,
  EndingZoneSound,
  ReloadPistol,
  ReloadRifle,
  ReloadShotgun,
  ReloadRPG,
  PickupPistolRifle,
  PickupShotgun,
  PickupRPG,
  OutOfAmmoPistol,
  OutOfAmmoRifle,
  OutOfAmmoShotgun,
  OutOfAmmoRPG,
  GameStartCountDownSound,
  Player_Death,
  Player_Oof,
  ItemGet,
}

@component()
export class SoundManager extends Component {
  public static instance: SoundManager | null = null;

// ✅ IEntity 배열로 변경
@property() private soundPool: readonly IEntity[] = [];
@property() private customSoundPool: readonly IEntity[] = [];

// 캐싱
private soundPoolComponents: SoundComponent[] = [];
private customSoundPoolComponents: SoundComponent[] = [];
private soundPoolTransform: TransformComponent[] = [];
private customSoundPoolTransform: TransformComponent[] = [];

@subscribe(OnEntityStartEvent)
onStart() {
  if (SoundManager.instance !== null) {
    this.entity.destroy();
    return;
  } else {
    SoundManager.instance = this;
  }

  this.Initialize();
}

private Initialize() 
{
  // SoundComponent와 TransformComponent 동시 캐싱
  this.soundPoolComponents = [];
  this.soundPoolTransform = [];
  
  for (let i = 0; i < this.soundPool.length; i++) {
    const entity = this.soundPool[i];
    const soundComp = entity?.getComponent(SoundComponent);
    const transform = entity?.getComponent(TransformComponent);
    
    if (!soundComp) {
      console.warn(`Sound at index ${i} (${SoundList[i]}) is missing SoundComponent`);
    }
    if (!transform) {
      console.warn(`Sound at index ${i} (${SoundList[i]}) is missing TransformComponent`);
    }
    
    this.soundPoolComponents.push(soundComp || null as any);
    this.soundPoolTransform.push(transform || null as any);
  }

  // 커스텀 사운드도 동일하게
  this.customSoundPoolComponents = [];
  this.customSoundPoolTransform = [];
  
  for (let i = 0; i < this.customSoundPool.length; i++) {
    const entity = this.customSoundPool[i];
    const soundComp = entity?.getComponent(SoundComponent);
    const transform = entity?.getComponent(TransformComponent);
    
    if (!soundComp) {
      console.warn(`Custom sound at index ${i} (${CustomSoundList[i]}) is missing SoundComponent`);
    }
    if (!transform) {
      console.warn(`Custom sound at index ${i} (${CustomSoundList[i]}) is missing TransformComponent`);
    }
    
    this.customSoundPoolComponents.push(soundComp || null as any);
    this.customSoundPoolTransform.push(transform || null as any);
  }
}

static PlaySound(position: Vec3, type: SoundList, volume: number = 0.4) {
  this.instance?.PlaySoundDetail({ position, type, volume });
}

static PlayCustomSound(position: Vec3, type: CustomSoundList, volume: number = 0.4) {
  this.instance?.PlayCustomSoundDetail({ position, type, volume });
}

private PlaySoundDetail(data: { position: Vec3; type: SoundList; volume: number | undefined }) {
  const hitSound = this.soundPoolComponents[data.type];
  const hitSoundTransform = this.soundPoolTransform[data.type];

  if (hitSound) {
    if (data.volume) hitSound.playVolume = data.volume;
    else hitSound.playVolume = 0.4;

    if (hitSoundTransform)
      hitSoundTransform.worldPosition = data.position;

    hitSound.play();
  }
}

private PlayCustomSoundDetail(data: { position: Vec3; type: CustomSoundList; volume: number | undefined }) {
  const hitSound = this.customSoundPoolComponents[data.type];
  const hitSoundTransform = this.customSoundPoolTransform[data.type];

  if (hitSound) {
    if (data.volume) hitSound.playVolume = data.volume;
    else hitSound.playVolume = 0.4;

    if (hitSoundTransform)
      hitSoundTransform.worldPosition = data.position;

    hitSound.play();
  }
}

  /*
  static PlaySoundWithAudioOptions(
    position: Vec3,
    type: SoundList,
    volume: number = 0.4,
    pitch: number = 0,
    audioOption: hz.AudioOptions,
    isPlay: boolean
  ) {
    this.instance?.PlaySoundWithAudioOptionsDetail({
      position,
      type,
      volume,
      pitch,
      audioOption,
      isPlay,
    });
  }

  static PlayCustomSoundWithAudioOptions(
    position: Vec3,
    type: CustomSoundList,
    volume: number = 0.4,
    pitch: number = 0,
    audioOption: hz.AudioOptions,
    isPlay = true
  ) {
    this.instance?.PlayCustomSoundWithAudioOptionsDetail({
      position,
      type,
      volume,
      pitch,
      audioOption,
      isPlay,
    });
  }

  private PlaySoundWithAudioOptionsDetail(data: {
    position: Vec3;
    type: SoundList;
    volume: number | undefined;
    pitch: number | undefined;
    audioOption: hz.AudioOptions | undefined;
    isPlay: boolean | false;
  }) {
    var hitSound: hz.AudioGizmo = this.GetSoundEffectPool(data.type);

    if (hitSound) {
      if (data.isPlay) {
        if (data.volume) hitSound.volume.set(data.volume);
        else hitSound.volume.set(0.4);

        if (data.pitch) hitSound.pitch.set(data.pitch);
        else hitSound.pitch.set(0);

        hitSound.position.set(data.position);

        this.async.setTimeout(() => {
          if (data.audioOption) hitSound.play(data.audioOption);
          else hitSound.play();
        }, 50);
      } else {
        if (data.audioOption) hitSound.stop(data.audioOption);
        else hitSound.stop();
      }
    }
  }

  private PlayCustomSoundWithAudioOptionsDetail(data: {
    position: hz.Vec3;
    type: CustomSoundList;
    volume: number | undefined;
    pitch: number | undefined;
    audioOption: hz.AudioOptions | undefined;
    isPlay: boolean | false;
  }) {
    var hitSound: hz.AudioGizmo = this.GetCustomSoundEffectPool(data.type);

    if (hitSound) {
      if (data.isPlay) {
        if (data.volume) hitSound.volume.set(data.volume);
        else hitSound.volume.set(0.4);

        if (data.pitch) hitSound.pitch.set(data.pitch);
        else hitSound.pitch.set(0);

        hitSound.position.set(data.position);

        this.async.setTimeout(() => {
          if (data.audioOption) {
            hitSound.play(data.audioOption);
          } else {
            hitSound.play();
          }
        }, 50);
      } else {
        if (data.audioOption) hitSound.stop(data.audioOption);
        else hitSound.stop();
      }
    }
  }
  */
}
