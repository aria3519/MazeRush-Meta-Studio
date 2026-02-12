import {component, Component, OnEntityStartEvent, PlayerComponent, subscribe} from 'meta/worlds';
import * as Events from './Events';

export enum DisruptorType{
  UFO,
  Missile,
  Slower,
}

type ResultData = {
  player: PlayerComponent;
  rank: number;
  pos: number;
};

@component()
export class DisruptorManager extends Component {
  @subscribe(OnEntityStartEvent)
  onStart() {
    console.log('onStart');
  }
}
