import {property, component, Component, OnEntityStartEvent, subscribe, VfxAsset, VfxComponent, TransformComponent, Vec3} from 'meta/worlds';
import { type Entity as IEntity } from 'meta/worlds';
import * as Events from './Events';

export enum EffectList {
  BulletHitVFX_Spark,
  BulletHitVFX_Spark2,
  BulletHitVFX_Explosion,
  BulletHitVFX_Explosion2,
  BulletHitVFX_WaterExplosion,
  BulletHitVFX_LightExplosion,
  BulletHitVFX_Funny,
  BulletHitVFX_Fire,
  BulletHitVFX_Sword,
  BulletHitVFX_Sword2,
  BulletHitVFX_Sword3,
  Large3DExplosionB,
  FireImpact_A,
  FireImpact_B,
  FireImpact_C,
  ImpactA,
  VFX_LavaFx,
  WaterSplash,
  Pkfx_FireHole,
  WaterSplash_Small,
  FireImpact_D,
  Gameplay,
  PoisonSmoke,
  BulletHitVFX_Explosion3,
}

@component()
export class EffectManager extends Component {
  public static instance: EffectManager | null = null;

  // ✅ IEntity 배열로 변경
  @property() private EffectPool: readonly IEntity[] = [];

  // 캐싱
  private effectPoolComponents: VfxComponent[] = [];
  private effectPoolTransform: TransformComponent[] = [];

  @subscribe(OnEntityStartEvent)
 onStart() {
   if (EffectManager.instance !== null) {
     this.entity.destroy();
     return;
   } else {
     EffectManager.instance = this;
   }
 
   this.Initialize();
 }
 
 private Initialize() 
 {
   // EffectComponent와 TransformComponent 동시 캐싱
   this.effectPoolComponents = [];
   this.effectPoolTransform = [];
   
   for (let i = 0; i < this.EffectPool.length; i++) {
     const entity = this.EffectPool[i];
     const EffectComp = entity?.getComponent(VfxComponent);
     const transform = entity?.getComponent(TransformComponent);
     
     if (!EffectComp) {
       console.warn(`Effect at index ${i} (${EffectList[i]}) is missing EffectComponent`);
     }
     if (!transform) {
       console.warn(`Effect at index ${i} (${EffectList[i]}) is missing TransformComponent`);
     }
     
     this.effectPoolComponents.push(EffectComp || null as any);
     this.effectPoolTransform.push(transform || null as any);
   }
 }
 
 static PlayEffect(position: Vec3, type: EffectList) {
   this.instance?.PlayEffectDetail({ position, type });
 }
 
 private PlayEffectDetail(data: { position: Vec3; type: EffectList; }) {
   const hitEffect = this.effectPoolComponents[data.type];
   const hitEffectTransform = this.effectPoolTransform[data.type];
 
   if (hitEffect) {
     if (hitEffectTransform)
       hitEffectTransform.worldPosition = data.position;
 
     hitEffect.play();
   }
 }
}
