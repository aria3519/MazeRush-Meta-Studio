import {
  component,
  Component,
  property,
  subscribe,

  // 이벤트 (이름은 프로젝트 템플릿에 따라 조금 다를 수 있음)
  OnEntityStartEvent,
  OnWorldUpdateEvent,
  OnWorldUpdateEventPayload,
  // 타입/유틸 (필요한 것만 추가)
  
  Vec2,
  Vec3,
  Quaternion,
  
  type Entity,
  type Asset,
  type Maybe,
  TransformComponent,
  MeshComponent,
  TemplateAsset,
  ColliderComponent,
  ColliderBoxComponent,
  PhysicsBodyComponent,
  
} from "meta/worlds";

export enum WallType {
  None = 0, // 벽 없음
  Normal = 1, // 일반 벽
  Moving = 2, // 트랩 벽
  MovingRev = 3, // 트랩 벽
}
type Cell = { x: number; y: number };
// 스파인(정답 경로) + 그 스파인 칸들에서 뻗어 나간 가지(재귀 트리)
interface Branch {
  fromSpineIndex: number; // 스파인 배열의 몇 번째 칸에서 가지가 시작되는지
  root: Cell; // 스파인과 맞닿은 첫 칸(스파인 바깥의 첫 칸)
  cells: Cell[]; // 이 가지의 연속 경로(루트 포함) - 분기점 전까지
  children: Branch[]; // 가지에서 또 분기된 하위 가지들
}

interface MazeSkeleton {
  spine: Cell[]; // start→end의 정답 경로(중앙 세로줄 느낌)
  branches: Branch[]; // 스파인 각 지점에서 뻗는 모든 가지들
}



export let tileType: number[][] = [];
export let horizontalWalls: number[][] = [];
export let verticalWalls: number[][] = [];

@component()
export class MazeGeneratorNew extends Component {
  // Use the @property decorator to expose a data type in the Studio property
  // panel.
  // @property()
  // exampleValue: string = 'default';

  // Called when the owning entity of this component is started.
  // All entities in the owning template have been created and it is now safe to
  // make cross entity references or send events.
  
  // Maze numbers
  @property()
  public width:number = 13 ;
  @property()
  public height:number = 13 ;
  @property()
  public cellSize:number = 1;
  @property()
  public mazeOrigin:Vec3 = new Vec3(0, 0, 0) ;
  @property()
  public startDelaySeconds:number = 30 ;
  @property()
  public restartDelaySeconds:number = 30 ;
  
  
 
  
  // Maze Entitys
  @property()
  public  mazeBlock!:Entity  ;
  @property()
  public  horizontalWalls!:Entity  ;
  @property()
  public  verticalWalls!:Entity  ;
  @property()
  public floorASpecialParent!:Entity ; 
  @property()
  public trapAParent!:Entity ; 
  @property()
  public trapBParent!:Entity ; 
  @property()
  public chestParent!:Entity ; 
  @property()
  public underBlockParent!:Entity ; 
  @property()
  public movingWallParentA!:Entity ; 
  @property()
  public movingWallParentB!:Entity ; 
  @property()
  public SafeZoneParent!:Entity ; 
  @property()
  public WaterZoneParent!:Entity ; 
  @property()
  public monsterParent!:Entity ; 
  @property()
  public bossmonsterParent!:Entity ; 
  



  

  private noTrapSet: Set<string> = new Set(); // "x,y" 문자열 키

    // 상자 포인트 관리
  private chestRespawns: { x: number; y: number }[] = [];
   // 몬스터 관리 map
  private monsterRespawns: Cell[] = [];
  private monsterSpots: { x: number; y: number }[] = [];

  private time =0;
  
  @subscribe(OnEntityStartEvent)
  onStart() {
   
    this.runSetup();
  }

  // @subscribe(OnWorldUpdateEvent)
  // onUpdate(params: OnWorldUpdateEventPayload) 
  // {
   
  //   this.time += params.deltaTime ;
  //   console.log("change All"+this.time)
  //   const children = this.mazeBlock?.getChildren();
  //   let index =0;
  //   if(this.time > 3)
  //   {
  //     this.time =0;
  //     console.log("change All")
  //      for (let x = 0; x < this.width; x++) {
  //     for (let y = 0; y < this.height; y++) {

  //        const child = children[index].getComponent(MeshComponent);
  //       //const childTrans = children[index].getComponent(TransformComponent);
  //       const childcol = children[index].getComponent(PhysicsBodyComponent);
  //       index++;

  //       if(child)
  //       {
  //         if(child.isVisibleSelf) child.isVisibleSelf = false;
  //         else child.isVisibleSelf = true;

  //       }

      
  //     }
  //   }

  //   }

  // }




    private runSetup(): void {
    this.generateMaze();
    this.buildMaze1();
    



  }






    private getStartEnd(): { start: { x: number; y: number }; end: { x: number; y: number } } {
    const width = this.width;
    const height = this.height;
    const mid = Math.floor(width / 2);
    // 현재 입/출구 뚫는 규칙과 맞춤 (가로벽 y=0, y=height-2)
    return {
      start: { x: mid, y: height - 2 },
      end: { x: mid, y: 0 },
    };
  }
  //#region placeTrapsOnPath Func
  findSolutionPath(start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number }[] {
    const width = this.width;
    const height = this.height;
    const visited = Array.from({ length: width }, () => Array(height).fill(false));
    const parent = Array.from({ length: width }, () => Array<{ x: number; y: number } | null>(height).fill(null));
    const queue: { x: number; y: number }[] = [];

    queue.push(start);
    visited[start.x][start.y] = true;

    const dirs = [
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.x === end.x && current.y === end.y) break;

      for (const dir of dirs) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[nx][ny] && tileType[nx][ny] !== 0 && !this.hasWallBetween(current, { x: nx, y: ny })) {
          visited[nx][ny] = true;
          parent[nx][ny] = current;
          queue.push({ x: nx, y: ny });
        }
      }
    }

    // 경로 역추적
    const path: { x: number; y: number }[] = [];
    let current: { x: number; y: number } | null = end;
    while (current) {
      path.push(current);
      current = parent[current.x][current.y];
    }

    return path.reverse();
  }

   // orientFilter: 'H' = 가로 복도만, 'V' = 세로 복도만, 생략 또는 'ANY' = 둘 다
  placeTrapsOnPath(path: { x: number; y: number }[], placedTraps: { x: number; y: number }[], trap2Count: number, trap3Count: number, waterzoneCoun: number) {
    const TRAP_SPACING = 4; // 4칸마다 1개
    const MIN_GAP = 2; // 함정 간 최소 거리
    // 0) 전역 차단 좌표 세팅
    this.noTrapSet.clear();
    const BLOCKED_TRAP_CELLS = [
      { x: 7, y: 0 },
      { x: 6, y: 0 },
      { x: 5, y: 0 },
      { x: 6, y: 12 },
      { x: 6, y: 11 }, // 필요시 추가
    ];
    for (const c of BLOCKED_TRAP_CELLS) this.noTrapSet.add(`${c.x},${c.y}`);
    const isTrapBlocked = (x: number, y: number) => this.noTrapSet.has(`${x},${y}`);

    function pickTrapTypeWithQuota(trap2Left: number, trap3Left: number, waterLeft: number): 2 | 3 | 5 | null {
      const options: { t: 2 | 3 | 5; w: number }[] = [];
      if (trap2Left > 0) options.push({ t: 2, w: 0.6 });
      if (trap3Left > 0) options.push({ t: 3, w: 0.3 });
      if (waterLeft > 0) options.push({ t: 5, w: 0.1 });

      if (options.length === 0) return null;

      const total = options.reduce((s, o) => s + o.w, 0);
      let r = Math.random() * total;
      for (const o of options) {
        r -= o.w;
        if (r <= 0) return o.t;
      }
      // 부동소수 오차 대비
      return options[options.length - 1].t;
    }

    // 실제 벽 기반으로 직선 복도인지 체크
    const isStraightCorridor = (pos: { x: number; y: number }): boolean => {
      const W = this.width;
      const H = this.height;

      const upWall = pos.y >= H - 1 || horizontalWalls[pos.x][pos.y] !== WallType.None;
      const downWall = pos.y <= 0 || horizontalWalls[pos.x][pos.y - 1] !== WallType.None;
      const leftWall = pos.x <= 0 || verticalWalls[pos.x - 1][pos.y] !== WallType.None;
      const rightWall = pos.x >= W - 1 || verticalWalls[pos.x][pos.y] !== WallType.None;

      // 가로 직선 (위아래 벽, 좌우 열림)
      const isHorizontal = upWall && downWall && !leftWall && !rightWall;
      // 세로 직선 (좌우 벽, 위아래 열림)
      const isVertical = leftWall && rightWall && !upWall && !downWall;

      return isHorizontal || isVertical;
    };

    // path를 따라 TRAP_SPACING 간격으로 체크
    for (let i = 0; i < path.length; ) {
      const pos = path[i];
      Math.random() < 0.6 ? 2 : 3;

      // 직선 복도가 아니면 스킵
      if (!isStraightCorridor(pos)) {
        i++;
        continue;
      }
      if (isTrapBlocked(pos.x, pos.y)) {
        i++;
        continue;
      }

      // 테두리면 스킵
      //if (!this.isInnerCell(pos.x, pos.y)) continue;

      // 이미 뭔가 있으면 스킵
      //if (tileType[pos.x][pos.y] !== 1) continue;

      // 다른 함정과 너무 가까우면 스킵
      if (!this.isFarEnough(pos, placedTraps, MIN_GAP)) {
        i++;
        continue;
      }
      if (pos.x == 6 && pos.y == 12) {
        i++;
        continue;
      }

      // 함정 설치
      //tileType[pos.x][pos.y] = pickTrapType();
      const t = pickTrapTypeWithQuota(trap2Count, trap3Count, waterzoneCoun);
      if (t === null) {
        // 전부 소진: 설치 스킵
      } else if (t === 2 && trap2Count > 0) {
        trap2Count--;
        tileType[pos.x][pos.y] = 2;
      } else if (t === 3 && trap3Count > 0) {
        trap3Count--;
        tileType[pos.x][pos.y] = 3;
      } else if (t === 5 && waterzoneCoun > 0) {
        waterzoneCoun--;
        tileType[pos.x][pos.y] = 5;
      }

      placedTraps.push(pos);
      i += TRAP_SPACING;
    }
    return { trap2Count, trap3Count, waterzoneCoun };
    //console.log(`[Traps] Placed ${placedTraps.length} traps on straight corridors`);
  }
  //#endregion


  //#region generateMaze
   generateMaze(opts?: { minSolutionLen?: number; maxSolutionLen?: number; maxAttempts?: number }) {
    const minLen = opts?.minSolutionLen ?? 50;
    const maxLen = opts?.maxSolutionLen ?? 90;
    const maxAttempts = Math.max(1, opts?.maxAttempts ?? 30);

    let bestPath: { x: number; y: number }[] = [];
    let lastAttempt = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      lastAttempt = attempt;
      this.carveMazeOnce();

      const { start, end } = this.getStartEnd();
      const path = this.findSolutionPath(start, end); // BFS (기존 함수 사용)

      // 저장해 두면 디버깅/폴백에 활용 가능
      if (path.length > bestPath.length) bestPath = path;

      // 길이 조건 체크
      if (path.length >= minLen && path.length <= maxLen) {
        this.CreateSpineTree();
        // 조건 통과 → 트랩/상자 등 배치
        //this.placeTrapsAndChests(this.props.width, this.props.height);
        console.log(`[Maze OK] attempt=${attempt}, pathLen=${path.length}`);

       
        return;
      }
      // 아니면 다음 시도
    }

    // 🔻 여기까지 왔다면 조건 충족 실패 → 폴백: 가장 긴 경로를 가진 마지막 상태로 빌드
    this.CreateSpineTree();
    // (바로 직전 carve 상태가 남아있으니 그대로 배치 진행)
    //this.placeTrapsAndChests(this.props.width, this.props.height);
    console.log(`[Maze Fallback] bestPathLen=${bestPath.length} (attempts=${lastAttempt}), min=${minLen}, max=${maxLen}`);
    
  }


  
  private CreateSpineTree() {
    // 1) 스파인/트리 만들기 (최소 신장 트리 ≒ BFS 스패닝 트리)
    const start = { x: Math.floor(this.width / 2), y: this.height - 1 };
    const end = { x: Math.floor(this.width / 2), y: 0 };
    const skeleton = this.buildMazeSkeleton(start, end);
    //console.log("CreateSpineTree spine len:", skeleton.spine.length);
    // 가지들을 길이(=cells.length) 기준 내림차순으로 정렬
    const branchesDesc = [...skeleton.branches].sort((a, b) => (b.cells?.length ?? 0) - (a.cells?.length ?? 0));
    // 0) 전역 차단 좌표 세팅
    this.noTrapSet.clear();
    const BLOCKED_TRAP_CELLS = [
      { x: 7, y: 0 },
      { x: 6, y: 0 },
      { x: 5, y: 0 },
      { x: 6, y: 12 },
      { x: 6, y: 11 }, // 필요시 추가
    ];
    for (const c of BLOCKED_TRAP_CELLS) this.noTrapSet.add(`${c.x},${c.y}`);
    const isTrapBlocked = (x: number, y: number) => this.noTrapSet.has(`${x},${y}`);

    //#region sub Trap Utile
    // (1) 가중치 재정규화된 타입 선택 (재고 없으면 null)
    // ───────────────────────────────────────────────────────────
    function pickTrapTypeWithQuota(left2: number, left3: number, left5: number): 2 | 3 | 5 | null {
      const ops: { t: 2 | 3 | 5; w: number }[] = [];
      if (left2 > 0) ops.push({ t: 2, w: 0.6 });
      if (left3 > 0) ops.push({ t: 3, w: 0.3 });
      if (left5 > 0) ops.push({ t: 5, w: 0.1 });
      if (ops.length === 0) return null;

      const total = ops.reduce((s, o) => s + o.w, 0);
      let r = Math.random() * total;
      for (const o of ops) {
        r -= o.w;
        if (r <= 0) return o.t;
      }
      return ops[ops.length - 1].t;
    }

    // ───────────────────────────────────────────────────────────
    // (2) 한 칸에 함정 설치 시도 (재고 차감 포함)
    //     - 직선 복도 칸이고
    //     - 길(1)이고
    //     - 타입을 뽑을 수 있으면 설치
    // ───────────────────────────────────────────────────────────
    const tryPlaceOneTrap = (x: number, y: number): boolean => {
      if (isTrapBlocked(x, y)) return false; // 🔒 가장 먼저
      if (!this.isStraightCorridorAt(x, y)) return false; // ㄱ/ㄴ/교차 금지
      if (!this.canPlaceAt(x, y)) return false; // 길(1)만

      const t = pickTrapTypeWithQuota(leftTrap2, leftTrap3, leftwaterzone5);
      if (t === null) return false;

      if (t === 2 && leftTrap2 > 0) {
        tileType[x][y] = 2;
        leftTrap2--;
        return true;
      }
      if (t === 3 && leftTrap3 > 0) {
         tileType[x][y] = 3;
        leftTrap3--;
        return true;
      }
      if (t === 5 && leftwaterzone5 > 0) {
         tileType[x][y] = 5;
        leftwaterzone5--;
        return true;
      }
      return false;
    };

    // ───────────────────────────────────────────────────────────
    // (3) 주어진 path 에 대해: i를 진행시키며
    //     - 직선 아니면 i += 1 (미루기)
    //     - 직선이고 설치 성공하면 i += step (점프)
    //     - 설치 실패면 i += 1 (미루기)
    // ───────────────────────────────────────────────────────────
    const placeTrapsEveryStepOnStraight = (path: { x: number; y: number }[], step = 3) => {
      let i = 2;
      const reversedPath = path.slice().reverse();
      while (i < reversedPath.length) {
        const p = reversedPath[i];
        if (this.isStraightCorridorAt(p.x, p.y)) {
          if (tryPlaceOneTrap(p.x, p.y)) {
            //console.log("tryPlaceOneTrap" + p.x ,"//"+p.y)
            i += step;
            continue;
          }
        }
        i += 1; // 직선 아니거나, 직선이지만 설치 실패 → 한 칸 미룸
      }
    };

    // ───────────────────────────────────────────────────────────
    // (4) 브랜치 재귀 처리: 자기 path + children
    // ───────────────────────────────────────────────────────────
    const placeTrapsOnBranchRecursive = (b: Branch) => {
      const branchPath = b.cells.length > 0 ? b.cells : [b.root];
      placeTrapsEveryStepOnStraight(branchPath, 3);
      for (const c of b.children) placeTrapsOnBranchRecursive(c);
    };
    //#endregion

    //#region chests Utile
    const isDeadEndCell = (x: number, y: number): boolean => {
      const W = this.width;
      const H = this.height;

      // 에지 처리를 포함한 벽 정보(true=벽)
      const w = this.getCellWallsEdgeAware ? this.getCellWallsEdgeAware(x, y) : this.getWallInfo({ x, y });

      // 열린 방향 개수(벽이 아니면 1, 벽이면 0)
      const open = (w.up ? 0 : 1) + (w.down ? 0 : 1) + (w.left ? 0 : 1) + (w.right ? 0 : 1);

      // 바깥 테두리면 open===1 또는 open===2 허용, 내부면 open===1만
      //const isBorder = (x === 0 || y === 0 || x === W - 1 || y === H - 1);
      return open === 1;
    };

    const placeChestsOnAllCuldeSacs = (maxChest: number) => {
      const W = this.width,
        H = this.height;
      const candidates: { x: number; y: number }[] = [];
      const blockedMonsterCells = [
        { x: 6, y: 12 },
        { x: 6, y: 11 },
        { x: 7, y: 0 },
        { x: 6, y: 0 },
        { x: 7, y: 12 },
        { x: 7, y: 11 },
      ];

      function isBlockedMonsterCell(x: number, y: number): boolean {
        return blockedMonsterCells.some((c) => c.x === x && c.y === y);
      }

      // 🔹 설정값
      //const maxChest = 10;     // 최대 상자 수
      const minSpacingInit = 4; // 최소 간격(맨해튼 거리). 필요시 조절

      // 🔹 1) 후보 수집
      for (let x = 0; x < W; x++) {
        for (let y = 0; y < H; y++) {
          if (isDeadEndCell(x, y) && tileType[x][y] === 1 && !(x == 7 && y == 0) && !(x == 6 && y == 0) && !(x == 6 && y == 12)) {
            candidates.push({ x, y });
          }
        }
      }
      this.chestRespawns = candidates;

      // 🔹 2) 랜덤 셔플
      this.shuffle(candidates);

      // 🔹 거리 함수(맨해튼)
      const manhattan = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

      // 🔹 이미 맵에 놓여있던 상자(=7)와도 간격 유지하고 싶다면 여기서 수집
      const prePlaced: { x: number; y: number }[] = [];
      for (let x = 0; x < W; x++) {
        for (let y = 0; y < H; y++) {
          if (tileType[x][y] === 7) prePlaced.push({ x, y });
        }
      }

      // 🔹 3) 간격 필터링 선택 (부족하면 간격을 줄이며 충원)
      const picked: { x: number; y: number }[] = [];
      let minSpacing = minSpacingInit;

      const canPlace = (p: { x: number; y: number }, spacing: number) => {
        // 기존에 뽑은 상자들과의 간격 체크
        for (const q of picked) {
          if (manhattan(p, q) < spacing) return false;
        }
        // 미리 존재하던 상자와의 간격도 지키고 싶으면 이 체크 유지
        for (const q of prePlaced) {
          if (manhattan(p, q) < spacing) return false;
        }
        return true;
      };

      // 1차: 설정 간격으로 최대한 뽑기
      for (const c of candidates) {
        if (picked.length >= maxChest) break;
        if (canPlace(c, minSpacing)) picked.push(c);
      }

      // 2차: 부족하면 간격을 1씩 낮추며 재시도
      while (picked.length < maxChest && minSpacing > 1) {
        minSpacing--;
        for (const c of candidates) {
          if (picked.length >= maxChest) break;
          // 이미 선택된 건 패스
          if (picked.some((p) => p.x === c.x && p.y === c.y)) continue;
          if (canPlace(c, minSpacing)) picked.push(c);
        }
      }

      // 🔹 4) 배치
      for (let i = 0; i < picked.length; i++) {
        const pos = picked[i];
        tileType[pos.x][pos.y] = 7;
        //console.log(`[CreateSpineTree] chest ${i + 1}: (${pos.x}, ${pos.y})`);
      }

      //console.log(`[CreateSpineTree] 후보=${candidates.length}, 배치=${picked.length}, 최종간격=${minSpacing}`);
      return picked.length;
    };
    //#endregion

    //#region monster Utile
    type Cell = { x: number; y: number };

    // sqrt 없이 제곱거리(더 빠르고 비교에 충분)
    const sqDist = (a: Cell, b: Cell) => {
      const dx = a.x - b.x,
        dy = a.y - b.y;
      return dx * dx + dy * dy;
    };

    function selectSpreadPoints(points: Cell[], n: number): Cell[] {
      if (!points || points.length === 0) return [];
      if (n <= 0) return [];

      // 후보가 n보다 적으면 셔플해서 전부 반환
      if (points.length <= n) {
        const copy = [...points];
        // 프로젝트에 this.shuffle 이 있으면 그걸 쓰고, 없으면 아래 셔플 사용
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      }

      const remaining = [...points];
      const selected: Cell[] = [];

      // 1) 첫 점 랜덤 선택
      const firstIdx = Math.floor(Math.random() * remaining.length);
      selected.push(remaining.splice(firstIdx, 1)[0]);

      // 2) 가장 먼 점을 반복 선택
      while (selected.length < n && remaining.length > 0) {
        let bestIdx = 0;
        let bestScore = -1;

        for (let i = 0; i < remaining.length; i++) {
          const p = remaining[i];
          // 이미 선택된 점들과의 "최소 제곱거리"
          let minSq = Number.POSITIVE_INFINITY;
          for (const s of selected) {
            const d = sqDist(p, s);
            if (d < minSq) minSq = d;
            // 조기 탈출(가속): 0이면 더 볼 필요 없음
            if (minSq === 0) break;
          }
          if (minSq > bestScore) {
            bestScore = minSq;
            bestIdx = i;
          }
        }

        selected.push(remaining.splice(bestIdx, 1)[0]);
      }

      return selected;
    }

     function placeMonstersSpread(monsterCandidates: Cell[], count: number, minGridDist = 0) {
      // 후보에서 고르게 분산된 좌표 선택
      // 🔹 상단 공용 헬퍼
      const blockedMonsterCells = [
        { x: 6, y: 12 },
        { x: 6, y: 11 },
        { x: 5, y: 12 },
        { x: 5, y: 11 },
        { x: 7, y: 12 },
        { x: 7, y: 11 },
      ];

      function isBlockedMonsterCell(x: number, y: number): boolean {
        return blockedMonsterCells.some((c) => c.x === x && c.y === y);
      }

      const picks = selectSpreadPoints(monsterCandidates, count);

      // 실제 배치 (여기선 tileType=8로 표시)
      let placed = 0;
      for (const p of picks) {
        // 이미 점유된 칸이면 스킵 (트랩/상자/벙커/문 등)
        if (tileType[p.x][p.y] !== 1 || isBlockedMonsterCell(p.x, p.y)) continue;
        tileType[p.x][p.y] = 8;
        //console.log(`[placeMonstersSpread] `,p.x ,p.y);
        placed++;
      }

      //console.log(`[MonsterSpread] candidates=${monsterCandidates.length}, requested=${count}, picked=${picks.length}, placed=${placed}`);
      return picks;
    }

    // 모든 분기점을 재귀적으로 수집하는 함수
    function collectAllBranchPoints(branch: Branch): Cell[] {
      const points: Cell[] = [];

      // 1) 현재 가지의 루트 (분기 시작점)
      //points.push(branch.root);

      // 2) 현재 가지 내에서 분기가 일어나는 지점들
      // cells를 따라가며 children이 있는 위치 찾기
      if (branch.children.length > 0) {
        // children이 있다는 것은 이 가지 어딘가에서 분기가 일어났다는 뜻
        // 보통 cells의 마지막 부분이나 중간 어딘가
        // 정확한 분기점은 growBranch 로직에 따라 다르지만,
        // 일반적으로 cells의 마지막 점이 분기점일 가능성이 높음
        if (branch.cells.length > 0) {
          const branchPoint = branch.cells[branch.cells.length - 1];
          if (!(branchPoint.x == 6 && branchPoint.y == 12) && tileType[branchPoint.x][branchPoint.y] == 1) points.push(branchPoint);
        }
      }

      // 3) 모든 자식 가지들의 분기점도 재귀적으로 수집
      for (const child of branch.children) {
        points.push(...collectAllBranchPoints(child));
      }

      return points;
    }
    function placeBunkersSpread(
      candidates: Cell[],
      count: number,
      opts?: {
        minManhattan?: number; // 서로 떨어질 최소 맨해튼 간격
        avoidKinds?: number[]; // 근접 회피할 타일 타입(예: 상자=7, 몬스터=8, 함정=2/3/5)
        avoidRadius?: number; // 회피 반경(맨해튼)
      }
    ): Cell[] {
      const minManhattan = opts?.minManhattan ?? 4;
      const avoidKinds = opts?.avoidKinds ?? [7, 8, 2, 3, 5];
      const avoidRadius = opts?.avoidRadius ?? 1;

      if (!candidates?.length || count <= 0) return [];

      // 후보 중복 제거
      const uniq = Array.from(new Map(candidates.map((p) => [`${p.x},${p.y}`, p])).values());

      // 멀리 떨어진 후보를 넉넉히 뽑은 뒤(oversample) 간격/회피 필터링
      const oversample = Math.min(uniq.length, Math.max(count * 3, count));
      const farPicks = selectSpreadPoints(uniq, oversample);

      const manhattan = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      const placed: Cell[] = [];

      const isNearKind = (p: Cell, kind: number, radius: number) => {
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -radius; dy <= radius; dy++) {
            const x = p.x + dx,
              y = p.y + dy;
            if (tileType[x]?.[y] === kind) return true;
          }
        }
        return false;
      };

      for (const p of farPicks) {
        if (placed.length >= count) break;

        // 설치 가능 칸만 (길=1)
        if (tileType[p.x]?.[p.y] !== 1) continue;

        // 회피 규칙: 상자/몬스터/함정 등 근처 회피
        let avoid = false;
        for (const k of avoidKinds) {
          if (isNearKind(p, k, avoidRadius)) {
            avoid = true;
            break;
          }
        }
        if (avoid) continue;

        // 이미 선택된 벙커들과의 최소 간격 보장
        let ok = true;
        for (const q of placed) {
          if (manhattan(p, q) < minManhattan) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        // 통과 → 실제 배치
        tileType[p.x][p.y] = 6; // 벙커
        placed.push(p);
      }

      return placed;
    }
    //#endregion
    //#region new Test Func
    type LeafDistance = {
      leaf: Cell; // 리프 셀
      branchPoint: Cell; // "마지막 분기점"(직전 분기점)
      localLength: number; // branchPoint → leaf (원하는 값)
      totalFromSpine: number; // 스파인 분기점 → leaf (참고용)
    };

    /**
     * parentBranchPoint: 이 호출 레벨에서의 "마지막 분기점"
     * accumFromSpine: 스파인 분기점으로부터 누적 길이(상위에서 내려온 값)
     */
    function collectLeafDistancesFromBranch(branch: Branch, parentBranchPoint: Cell, accumFromSpine: number = 0): LeafDistance[] {
      const out: LeafDistance[] = [];

      // 이 가지의 선형 길이 (parentBranchPoint → 이 가지의 말단/분기점까지)
      const segLen = branch.cells.length;

      // 이 가지의 분기점(하위로 갈라지는 지점): 보통 cells의 마지막 칸
      const thisBranchPoint: Cell | null = branch.children.length > 0 ? (branch.cells.length > 0 ? branch.cells[branch.cells.length - 1] : branch.root) : null;

      if (branch.children.length === 0) {
        // 리프: 마지막 분기점 = parentBranchPoint
        const leaf = branch.cells.length > 0 ? branch.cells[branch.cells.length - 1] : branch.root;
        out.push({
          leaf,
          branchPoint: parentBranchPoint,
          localLength: segLen, // 바로 이게 "서브 가지에서 마지막 분기점~리프" 길이
          totalFromSpine: accumFromSpine + segLen,
        });
      } else {
        // 자식 가지들: 이 레벨의 마지막 분기점은 thisBranchPoint
        const nextAccum = accumFromSpine + segLen;
        for (const child of branch.children) {
          // 자식에게는 "마지막 분기점"을 갱신해서 넘김
          const childDs = collectLeafDistancesFromBranch(
            child,
            thisBranchPoint!, // 자식의 마지막 분기점
            nextAccum // 스파인부터 누적
          );
          // 자식 결과는 이미 올바른 'branchPoint'(=thisBranchPoint)와 localLength를 가지고 있음
          out.push(...childDs);
        }
      }

      return out;
    }

    function collectAllLeafDistances(skel: { spine: Cell[]; branches: Branch[] }): LeafDistance[] {
      const all: LeafDistance[] = [];
      for (const br of skel.branches) {
        const idx = br.fromSpineIndex;
        if (idx == null || idx < 0 || idx >= skel.spine.length) continue;
        const parentPoint = skel.spine[idx]; // top-level 가지의 스파인 분기점
        const ds = collectLeafDistancesFromBranch(br, parentPoint, 0);
        all.push(...ds);
      }
      return all;
    }
    //#endregion

    // -------- 카운터 설정 --------
    let leftTrap2 = 12; // 함정(2)
    let leftTrap3 = 8; // 함정(3)
    let leftwaterzone5 = 2; // 흙탕물(5)
    let leftChest7 = 10; // 보물상자(7)
    let leftMon8 = 12; // 몬스터(8)
    let leftBunker = 4; // 벙커(6)

    const monsterCandidates: Cell[] = [];
    const bunkerCandidates: Cell[] = [];

    // 정답길에 4칸씩 함정 설치
    const path = this.findSolutionPath(start, end); // 정답 경로만
    const placedTraps: { x: number; y: number }[] = [];
    let trapcounts = this.placeTrapsOnPath(path, placedTraps, leftTrap2, leftTrap3, leftwaterzone5);
    leftTrap2 = trapcounts.trap2Count;
    leftTrap3 = trapcounts.trap3Count;
    leftwaterzone5 = trapcounts.waterzoneCoun;
    // console.log("[CreateSpineTree] chest",branchesDesc.length);

    // 내림 차순으로 정렬된 가지들
    for (const b of branchesDesc) {
      // 안전 가드: fromSpineIndex가 유효한지 확인
      if (b.fromSpineIndex == null || b.fromSpineIndex < 0 || b.fromSpineIndex >= skeleton.spine.length) {
        //console.warn(`[CreateSpineTree] invalid fromSpineIndex=${b.fromSpineIndex}`);
        continue;
      }

      const joint = skeleton.spine[b.fromSpineIndex]; // 스파인 분기점
      const endPoint = b.cells.length ? b.cells[b.cells.length - 1] : b.root; // 가지 끝점

      // 몬스터 스폰 위치 수집
      monsterCandidates.push(joint);
      // 2) ✅ 이 가지와 모든 하위 가지의 분기점들도 수집!
      const subBranchPoints = collectAllBranchPoints(b);
      monsterCandidates.push(...subBranchPoints);

      // ✅ 함정: 이 가지와 자식 가지들에서 3칸마다 (직선 칸만)
      placeTrapsOnBranchRecursive(b);

      // 벙커
      bunkerCandidates.push(b.cells[0]); // 원래 깔던 위치(가지 첫 칸)를 후보로
      // (선택) 긴 가지는 중간 지점도 추가해 다양성 확보
      if (b.cells.length >= 6) bunkerCandidates.push(b.cells[Math.floor(b.cells.length / 2)]);

      // console.log(
      //   `CreateSpineTree branch at spine[${b.fromSpineIndex}] ` +
      //   `(${joint.x},${joint.y}) -> end=(${end.x},${end.y}) len=${b.cells.length}`
      // );
    }

    // 몬스터 스폰 실제 스폰 위치
    // 3) 중복 제거 (같은 좌표가 여러 번 들어갈 수 있음)
    const uniqueCandidates = Array.from(new Map(monsterCandidates.map((p) => [`${p.x},${p.y}`, p])).values());
    this.monsterRespawns = uniqueCandidates;
    // 4) 분산 배치
    this.monsterSpots = placeMonstersSpread(uniqueCandidates, leftMon8, 4);

    // 보물상자
    placeChestsOnAllCuldeSacs(leftChest7);

    // 벙커
    // 후보 정리
    const uniqBunkerCandidates = Array.from(new Map(bunkerCandidates.map((p) => [`${p.x},${p.y}`, p])).values());

    // 분산 배치
    const placedBunkers = placeBunkersSpread(uniqBunkerCandidates, leftBunker, {
      minManhattan: 4, // 더 벌리고 싶으면 5~6
      avoidKinds: [], // 상자/몬스터/함정 주변 회피
      avoidRadius: 1, // 1~2 권장
    });

    // 카운트 갱신 및 기록(선택)
    leftBunker -= placedBunkers.length;

    // console.log("CreateSpineTree placedTraps: ", placedTraps.length+
    //   "CreateSpineTree leftTrap2: ", leftTrap2 +" leftTrap3: ",leftTrap3," leftwaterzone5: ",leftwaterzone5,
    //   " leftBunker: ",leftBunker);

    //   // 2) 모든 리프의 거리 수집
    // const leafDistances = collectAllLeafDistances(skeleton);

    // // 3) "서브 가지에서 마지막 분기점 ↔ 리프" 거리(localLength) 기준 내림차순 정렬
    // leafDistances.sort((a, b) => b.localLength - a.localLength);

    // // 4) 상위 K개만 예시로 사용 (필요 수만큼)
    // const K = Math.min(10, leafDistances.length);
    // for (let i = 0; i < K; i++) {
    //   const { leaf, branchPoint, localLength, totalFromSpine } = leafDistances[i];

    //   // 예: 데드엔드 보상/트랩/몬스터 배치 후보로 활용
    //   // if (tileType[leaf.x]?.[leaf.y] === 1) tileType[leaf.x][leaf.y] = 7;

    //   // 디버그
    //   console.log(
    //     `[SubBranch#${i}] lastBranch=(${branchPoint.x},${branchPoint.y}) `
    //     + `→ leaf=(${leaf.x},${leaf.y}), `
    //     + `local=${localLength}, totalFromSpine=${totalFromSpine}`
    //   );
    // }
  }

  //#endregion


  //#region MazeSkeleton
  private buildMazeSkeleton(start: Cell, end: Cell, walkable: (x: number, y: number) => boolean = (x, y) => tileType[x]?.[y] === 1): MazeSkeleton {
    // 1) 스파인(정답 경로)
    const spine = this.findSolutionPath(start, end);
    const skeleton: MazeSkeleton = { spine, branches: [] };
    if (spine.length === 0) return skeleton;

    // 빠른 조회용
    const spineSet = new Set(spine.map((p) => `${p.x},${p.y}`));

    // 2) 가지 찾기: 스파인의 각 칸에서 "스파인 바깥 이웃"으로 출발
    const seen = Array.from({ length: this.width }, () => Array(this.height).fill(false));

    // 이웃(통행 가능) 가져오기
    const neighbors = (p: Cell) => {
      const dirs = [
        { x: 0, y: 1 },
        { x: 0, y: -1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ];
      const res: Cell[] = [];
      for (const d of dirs) {
        const nx = p.x + d.x,
          ny = p.y + d.y;
        if (!this.inBounds(nx, ny)) continue;
        if (!walkable(nx, ny)) continue;
        if (this.hasWallBetween(p, { x: nx, y: ny }) !== WallType.None) continue;
        res.push({ x: nx, y: ny });
      }
      return res;
    };

    // 분기 따라가며 가지 트리 만들기 (스파인과 만나는 순간/이미 본 곳은 중단)
    const growBranch = (cur: Cell, prev: Cell | null): Branch | null => {
      // 이미 본 곳이면 스킵
      if (seen[cur.x][cur.y]) return null;

      // 큐가 아니라 "선형 구간"을 우선 수집하고, 분기점에서 children 생성
      const cells: Cell[] = [];
      let node: Cell = cur;
      let parent: Cell | null = prev;

      while (true) {
        if (spineSet.has(`${node.x},${node.y}`)) break; // 스파인으로 되돌아오면 stop
        if (seen[node.x][node.y]) break; // 이미 처리된 칸이면 stop
        if (!walkable(node.x, node.y)) break;

        seen[node.x][node.y] = true;
        cells.push(node);

        // 이웃 중 parent(되돌아가는 방향) 제외
        const nbs = neighbors(node).filter((n) => !(parent && n.x === parent.x && n.y === parent.y));

        if (nbs.length === 0) {
          // 막다른 길(리프) → 선형 구간 끝
          break;
        } else if (nbs.length === 1) {
          // 계속 직진 가능 → 이어붙임
          parent = node;
          node = nbs[0];
          continue;
        } else {
          // 분기점 → 여기서 children들을 재귀로
          const children: Branch[] = [];
          for (const n of nbs) {
            const child = growBranch(n, node);
            if (child) children.push(child);
          }
          // 현재 선형 구간(cells)의 첫 칸을 루트로 잡고 반환
          return {
            fromSpineIndex: -1, // 호출부에서 설정
            root: cells[0],
            cells,
            children,
          };
        }
      }

      // 분기 없이 끝난 선형 가지
      return {
        fromSpineIndex: -1,
        root: cells[0] ?? cur,
        cells,
        children: [],
      };
    };

    // 스파인 각 인덱스에서 스파인 밖으로 나가는 이웃을 가지로 확대
    for (let i = 0; i < spine.length; i++) {
      const s = spine[i];
      const outNbs = neighbors(s).filter((n) => !spineSet.has(`${n.x},${n.y}`));
      for (const n of outNbs) {
        if (seen[n.x][n.y]) continue;
        const br = growBranch(n, s);
        if (!br) continue;
        // ✅ fromSpineIndex를 하위 가지들까지 재귀적으로 전파
        const setIndexRec = (b: Branch, idx: number) => {
          b.fromSpineIndex = idx;
          for (const c of b.children) setIndexRec(c, idx);
        };
        setIndexRec(br, i);

        skeleton.branches.push(br);
      }
    }

    return skeleton;
  }
  //#endregion

  

   //#region carveMazeOnce
  private carveMazeOnce(): void {
    const width = this.width;
    const height = this.height;

    // 데이터 초기화
    tileType = Array.from({ length: width }, () => Array(height).fill(0));
    const visited = Array.from({ length: width }, () => Array(height).fill(false));
    horizontalWalls = Array.from({ length: width }, () => Array(height - 1).fill(WallType.Normal));
    verticalWalls = Array.from({ length: width - 1 }, () => Array(height).fill(WallType.Normal));

    type Cell = { x: number; y: number };
    const dirZero: Cell = { x: 0, y: 0 };
    const inBounds = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height;
    const stepDir = (a: Cell, b: Cell): Cell => ({ x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) });
    const dirEq = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

    // 시작점(바깥 가장자리 포함 가능)
    const defaultStarts: Cell[] = [
      { x: 0, y: 0 },
      { x: width - 2, y: 0 },
      { x: 0, y: height - 2 },
      { x: width - 2, y: height - 2 },
    ];
    const starts: Cell[] = (this as any).props?.starts?.length ? (this as any).props.starts : defaultStarts;

    // DSU/기록/스택/방향 연속 제어
    const seeds = starts.length;
    const parent = Array.from({ length: seeds }, (_, i) => i);
    const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
    const unite = (a: number, b: number) => {
      const ra = find(a),
        rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    };

    const carvedBy: number[][] = Array.from({ length: width }, () => Array(height).fill(-1));
    starts.forEach((st, i) => {
      visited[st.x][st.y] = true;
      tileType[st.x][st.y] = 1;
      carvedBy[st.x][st.y] = i;
    });
    const stacks: Cell[][] = starts.map((st) => [st]);
    const lastDirs: Cell[] = Array.from({ length: seeds }, () => dirZero);
    const dirStreaks: number[] = Array(seeds).fill(0);
    let components = seeds;
    const activeCount = () => stacks.reduce((acc, s) => acc + (s.length > 0 ? 1 : 0), 0);

    const hasWallBetweenLocal = (a: Cell, b: Cell): boolean => {
      if (a.x === b.x) {
        const yLow = Math.min(a.y, b.y);
        if (yLow < 0 || yLow >= height - 1) return false;
        return horizontalWalls[a.x][yLow] !== WallType.None;
      } else if (a.y === b.y) {
        const xLow = Math.min(a.x, b.x);
        if (xLow < 0 || xLow >= width - 1) return false;
        return verticalWalls[xLow][a.y] !== WallType.None;
      }
      return false;
    };

    // 🔒 무한루프 방지 가드
    const SAFE_MAX = width * height * 10;

    let turn = 0;
    for (let guard = 0; guard < SAFE_MAX && activeCount() > 0; guard++) {
      const s = stacks[turn];
      if (s.length > 0) {
        const current = s[s.length - 1];

        // 후보 수집
        let neighbors: Cell[] = this.getUnvisitedNeighbors(current, visited, width, height);

        // '같은 방향 3칸 이상이면 회전 우선' 규칙
        if (dirStreaks[turn] >= 3 && !dirEq(lastDirs[turn], dirZero)) {
          const hasAlt = neighbors.some((n) => !dirEq(stepDir(current, n), lastDirs[turn]));
          if (hasAlt) neighbors = neighbors.filter((n) => !dirEq(stepDir(current, n), lastDirs[turn]));
        }

        // 2×2 오픈방 방지: 우선 제외
        let filtered = neighbors.filter((n) => !this.wouldMakeOpen2x2(current, n));

        // 만약 전부 걸러지면, 완전 막힘을 피하려고 한 칸은 허용(랜덤)
        if (neighbors.length > 0 && filtered.length === 0) {
          filtered = [neighbors[Math.floor(Math.random() * neighbors.length)]];
        }
        neighbors = filtered;

        if (neighbors.length > 0) {
          // 후보 중 랜덤 선택
          const next = neighbors[Math.floor(Math.random() * neighbors.length)];
          const d = stepDir(current, next);

          // 안전하게 벽 제거/카빙
          this.removeWall(current, next);
          visited[next.x][next.y] = true;
          tileType[next.x][next.y] = 1;
          carvedBy[next.x][next.y] = turn;
          s.push(next);

          if (dirEq(d, lastDirs[turn])) dirStreaks[turn]++;
          else {
            lastDirs[turn] = d;
            dirStreaks[turn] = 1;
          }
        } else {
          // 🔙 백트랙/컴포넌트 병합
          let merged = false;
          if (components > 1) {
            const dirs: Cell[] = [
              { x: 1, y: 0 },
              { x: -1, y: 0 },
              { x: 0, y: 1 },
              { x: 0, y: -1 },
            ];
            for (const d of dirs) {
              const meet = { x: current.x + d.x, y: current.y + d.y };
              if (!inBounds(meet.x, meet.y)) continue;
              if (!visited[meet.x][meet.y]) continue;
              const other = carvedBy[meet.x][meet.y];
              if (other < 0 || other === turn) continue;

              // 바깥 테두리에서의 무리한 병합 방지(입구 주변 우회로 억제)
              const isOuter = (p: Cell) => p.x === 0 || p.x === width - 1 || p.y === 0 || p.y === height - 1;
              if (isOuter(current) || isOuter(meet)) continue;

              if (find(turn) !== find(other)) {
                if (hasWallBetweenLocal(current, meet)) this.removeWall(current, meet);
                unite(turn, other);
                components--;
                merged = true;
                break;
              }
            }
          }
          if (!merged) {
            const from = s.pop()!;
            if (s.length > 0) {
              const to = s[s.length - 1];
              const dBack = stepDir(from, to);
              if (dirEq(dBack, lastDirs[turn])) dirStreaks[turn]++;
              else {
                lastDirs[turn] = dBack;
                dirStreaks[turn] = 1;
              }
            } else {
              lastDirs[turn] = dirZero;
              dirStreaks[turn] = 0;
            }
          }
        }
      }
      turn = (turn + 1) % seeds;
    }

    // ✅ 입·출구 뚫기
    const mid = Math.floor(width / 2);
    
  }
  //#endregion






   //#region buildMaze1
  private delayedPlacements: { fn: () => void }[] = [];

  buildMaze1() {
    const width = this.width;
    const height = this.height;
    const cs = this.cellSize;
    const origin = this.mazeOrigin;
    const floorAChildren = this.shuffle([...(this.floorASpecialParent?.getChildren() || [])]);
    const trapAChildren = this.shuffle([...(this.trapAParent?.getChildren() || [])]);
    const trapBChildren = this.shuffle([...(this.trapBParent?.getChildren()  || [])]);
    const trapChildren = this.shuffle([...(this.trapAParent?.getChildren()  ?? []), ...(this.trapBParent?.getChildren()  ?? [])]);
    const chestChildren = this.chestParent?.getChildren()  || [];
    const underblockChildren = this.underBlockParent?.getChildren()  || [];
    const MonsterChildren = this.shuffle([...(this.monsterParent?.getChildren()  || [])]);
    const bossmonsterParent = this.shuffle([...(this.bossmonsterParent?.getChildren()  || [])]);
    const SafeZoneChildren = this.shuffle([...(this.SafeZoneParent?.getChildren()  || [])]);
    const WaterZoneChildren = this.shuffle([...(this.WaterZoneParent?.getChildren()  || [])]);

    // ✅ 그룹화(프리팹 이름별 큐)
    const floorAGroups = this.groupByName(floorAChildren); // type 2용
    const trapAGroups = this.groupByName(trapAChildren);
    const trapBGroups = this.groupByName(trapBChildren);

    // ✅ 배치 기록(중복/거리 계산용) - 타입별로 따로 관리
    const placedTrapA: {
      x: number;
      y: number;
      prefab: string;
      usedAt: number;
    }[] = [];
    const placedTrapB: {
      x: number;
      y: number;
      prefab: string;
      usedAt: number;
    }[] = [];
    const placedFloorA: {
      x: number;
      y: number;
      prefab: string;
      usedAt: number;
    }[] = [];

    let trapAIndex = 0;
    let trapBIndex = 0;
    let trapIndex = 0;
    let floorAIndex = 0;
    let chestIndex = 0;
    let underblockIndex = 0;
    let monsterIndex = 0;
    let SafeZoneIndex = 0;
    let WaterZoneIndex = 0;
    let TrapMonsterIndex = 0;

    let waitTime = 7500;
    // === 타일 ===

    const children = this.mazeBlock?.getChildren();
    //const children = this.mazeBlockEnt?.children.get();
    // if (!children) return;

    // 보스몬스터 고정 자리 처리
    const pos = new Vec2(6, 12);
    let timertemp = this.startDelaySeconds * 1000;
    const child = bossmonsterParent[0];
    // this.async.setTimeout(() => {
    //   this.sendNetworkEvent(child, Events.npcInit, { pos });
    //   //child.visible.set(true);
    //   //child.collidable.set(true);
    //   //child.position.set(pos);
    // }, timertemp);

    let index = 0;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const type = tileType[x][y];
        const pos = new Vec3(x * cs, 0, y * cs).add(origin);
       
        const child = children[index].getComponent(MeshComponent);
        //const childTrans = children[index].getComponent(TransformComponent);
        const childcol = children[index].getComponent(PhysicsBodyComponent);
        index++;
        //child.visible.set(true); // 보일지 여부
        //child.collidable.set(true); // 충돌 여부
         //if (tileType[x][y] == 2 || tileType[x][y] == 5) {
        //if(child && childTrans && childcol)
        if(child &&childcol )
        {
        if (type === 2  || type === 5) {
          
          child.isVisibleSelf = true; // 보일지 여부
          childcol.collisionEnabled =true;
          // this.async.setTimeout(() => {
          //   child.visible.set(false); // 보일지 여부
          //   child.collidable.set(false); // 충돌 여부
          // }, waitTime);
          this.delayedPlacements.push({
            fn: () => {
              child.isVisibleSelf = false; // 보일지 여부
              //childcol.collisionEnabled = false; 
              //childTrans.worldPosition = pos;
             
              // 회전도 여기에서 세팅
            },
          });
        }
        else
        {
            child.isVisibleSelf = true;
             childcol.collisionEnabled =true;
           //child.isVisibleSelf = false; // 보일지 여부
           //childcol.collisionEnabled = false;  // 충돌 여부
          
        }
        }

        // === 특수 타일 처리 ===
      //   if (type === 2 && floorAIndex < floorAChildren.length) {
      //     const w = this.getCellWallsEdgeAware(x, y);

      //     // 복도 방향 판정
      //     // - 가로 복도: 위/아래 닫힘 + 좌/우 열림  → X축 방향 (yaw 0° 기본)
      //     // - 세로 복도: 좌/우 닫힘 + 위/아래 열림 → Z축 직각 (yaw 90°)
      //     const isHorizontalCorridor = w.up && w.down && !w.left && !w.right;
      //     const isVerticalCorridor = w.left && w.right && !w.up && !w.down;

      //     // ✅ 군집 억제 선택 (반경 3, LRU bias 켬)
      //     //const floorA = this.pickPrefabAntiClump(placedFloorA, floorAGroups, { x, y }, 3, true);
      //     const floorA = floorAChildren[floorAIndex++].getComponent(TransformComponent);
      //     const floorAMesh = floorAChildren[floorAIndex].getComponent(MeshComponent);
      //     const floorAcol = floorAChildren[floorAIndex].getComponent(ColliderComponent);
      //     if (floorA&&floorAMesh&&floorAcol) {
      //       // this.async.setTimeout(() => {
      //       //   floorA.visible.set(true);
      //       //   floorA.collidable.set(true);
      //       //   floorA.position.set(pos);
      //       // }, waitTime);
      //       this.delayedPlacements.push({
      //         fn: () => {
      //           floorAMesh.isVisibleSelf =true;
      //           floorAcol.collisionLayer = 2;
      //           floorA.worldPosition =pos;
      //           // 회전도 여기에서 세팅
      //         },
      //       });

      //       // 회전 규칙 유지 + Fragile 계열 랜덤 0/180
      //       let randYaw180 = Math.random() < 0.5 ? 0 : 180;
      //       const name = floorA.name;

      //       // ✅ 공통 함수: 남은 후보들(floorAIndex 이후)에서 특정 이름 제거
      //       const removeFromRemaining = (banName: string) => {
      //         for (let i = floorAChildren.length - 1; i >= floorAIndex; i--) {
      //           const child = floorAChildren[i];
      //           if (child.name === banName) {
      //             floorAChildren.splice(i, 1);
      //           }
      //         }
      //       };

      //       // 여기서 조건만 깔끔하게
      //       if (name === "Platform_FragileCross") {
      //         removeFromRemaining("Platform_FragileLinear");
      //       } else if (name === "Platform_FragileLinear") {
      //         removeFromRemaining("Platform_FragileCross");
      //       } else if (name === "Platform_FragileLong1") {
      //         removeFromRemaining("Platform_FragileLong2");
      //       } else if (name === "Platform_FragileLong2") {
      //         removeFromRemaining("Platform_FragileLong1");
      //       }

      //       if (isHorizontalCorridor) {
      //         // 세로 복도(↑↓ 막힘, ←→ 열림)
      //         floorA.worldRotation= Quaternion.fromEuler(new Vec3(0, 90, 0));
      //         if (name === "Platform_FragileCross" || name === "Platform_FragileLinear") {
      //           floorA.worldRotation =Quaternion.fromEuler(new Vec3(0, 90 + randYaw180, 0));
      //         }
      //       } else if (isVerticalCorridor) {
      //         // 가로 복도(↑↓ 열림, ←→ 막힘)
      //         floorA.worldRotation =(Quaternion.fromEuler(new Vec3(0, 0, 0)));
      //         if (name === "Platform_FragileCross" || name === "Platform_FragileLinear") {
      //           floorA.worldRotation = Quaternion.fromEuler(new Vec3(0, 0 + randYaw180, 0));
      //         }
      //       } else {
      //         floorA.worldRotation = (Quaternion.fromEuler(new Vec3(0, 0, 0)));
      //       }

      //       // 언더블록 배치 (워터풀Z는 제외 유지)
      //       const under = underblockChildren[underblockIndex++].getComponent(TransformComponent);
      //       const underMesh = underblockChildren[underblockIndex].getComponent(MeshComponent);
      //       const underCol = underblockChildren[underblockIndex].getComponent(ColliderComponent);

      //       if (under&&underMesh&&underCol) {
      //         // this.async.setTimeout(() => {
      //         //   under.visible.set(true);
      //         //   under.collidable.set(true);
      //         //   under.position.set(pos);
      //         // }, waitTime);
      //         this.delayedPlacements.push({
      //           fn: () => {
      //             underMesh.isVisibleSelf = true;
      //             underCol.collisionLayer =2;
      //             under.worldPosition =pos;

      //             // 회전도 여기에서 세팅
      //           },
      //         });

      //         if (isHorizontalCorridor) under.worldRotation = (Quaternion.fromEuler(new Vec3(0, 90, 0)));
      //         else if (isVerticalCorridor) under.worldRotation =(Quaternion.fromEuler(new Vec3(0, 0, 0)));
      //         else under.worldRotation = (Quaternion.fromEuler(new Vec3(0, 0, 0)));
      //       }
      //     } 

      //     continue; // 이미 처리했으니 다음 타일로
      //   } else if (type === 3) {
      //     const w = this.getCellWallsEdgeAware(x, y);
      //     // 복도 방향 판정
      //     // - 가로 복도: 위/아래 닫힘 + 좌/우 열림  → X축 방향 (yaw 0° 기본)
      //     // - 세로 복도: 좌/우 닫힘 + 위/아래 열림 → Z축 직각 (yaw 90°)
      //     const isHorizontalCorridor = w.up && w.down && !w.left && !w.right;
      //     const isVerticalCorridor = w.left && w.right && !w.up && !w.down;
      //     let yaw = 0;

      //     const trapChild = trapChildren[trapIndex++].getComponent(TransformComponent);
      //     const trapChildMesh = trapChildren[trapIndex].getComponent(MeshComponent);
      //     const trapChildCol = trapChildren[trapIndex].getComponent(ColliderComponent);
      //     if (trapChild&&trapChildMesh&&trapChildCol) {
      //       // this.async.setTimeout(() => {
      //       //   trapChild.visible.set(true);
      //       //   trapChild.collidable.set(true);
      //       //   trapChild.position.set(pos);
      //       // }, waitTime);
      //       this.delayedPlacements.push({
      //         fn: () => {
      //           trapChildMesh.isVisibleSelf = true;
      //           trapChildCol.collisionLayer =2;
      //           trapChild.worldPosition =pos;
      //           // 회전도 여기에서 세팅
      //         },
      //       });
      //       if (isHorizontalCorridor) yaw = 90;
      //       trapChild.worldRotation = Quaternion.fromEuler(new Vec3(0, yaw, 0));
      //     }
      //   } else if (type === 7 && chestIndex < chestChildren.length) {
      //  const wallInfo = this.getWallInfo({ x, y });
      //   const child = chestChildren[chestIndex++].getComponent(TransformComponent);
      //   const childMesh = chestChildren[chestIndex].getComponent(MeshComponent);
        
        
      

      //   const inBounds = (nx: number, ny: number) =>
      //     nx >= 0 && ny >= 0 && nx < width && ny < height;

      //   // ✅ (0,0이 왼쪽 아래)이면 Up=y+1, Down=y-1
      //   let openUp = inBounds(x, y + 1) && !wallInfo.up;
      //   let openDown = inBounds(x, y - 1) && !wallInfo.down;
      //   let openLeft = inBounds(x - 1, y) && !wallInfo.left;
      //   let openRight = inBounds(x + 1, y) && !wallInfo.right;

      //   // ✅ 외곽 체크 (Bottom=0번줄, Top=끝줄)
      //   const atLeft = x === 0;
      //   const atRight = x === width - 1;
      //   const atBottom = y === 0;
      //   const atTop = y === height - 1;

      //   // ✅ 외곽이면 “바깥 방향” open 제외 (코너면 2개 동시에 제외)
      //   if (atLeft) openLeft = false;
      //   if (atRight) openRight = false;
      //   if (atBottom) openDown = false; // 아래 외곽이면 아래 방향 제외
      //   if (atTop) openUp = false;      // 위 외곽이면 위 방향 제외

      //   if (child&&childMesh) {
      //     let rotY: number | null = null;

      //     // ✅ 0번줄/끝줄은 세로(안쪽) 우선 처리 (좌표계 반영 완료)
      //     if (atBottom) {
      //       // 아래줄이면 위(안쪽) 우선
      //       if (inBounds(x, y + 1) && !wallInfo.up) rotY = 0;
      //     } else if (atTop) {
      //       // 위줄이면 아래(안쪽) 우선
      //       if (inBounds(x, y - 1) && !wallInfo.down) rotY = 180;
      //     }

      //     // ✅ 위에서 못 정했을 때만 남은 open으로 결정
      //     if (rotY === null) {
      //       if (openUp) rotY = 0;
      //       else if (openDown) rotY = 180;
      //       else if (openLeft) rotY = -90;
      //       else if (openRight) rotY = 90;
      //     }

      //     // ✅ 그래도 없으면 “안쪽” fallback
      //     if (rotY === null) {
      //       if (atBottom) rotY = 0;
      //       else if (atTop) rotY = 180;
      //       else if (atLeft) rotY = 90;
      //       else if (atRight) rotY = -90;
      //       else rotY = 0;
      //     }

      //     const rot = Quaternion.fromEuler(new Vec3(0, rotY, 0));

      //     this.delayedPlacements.push({
      //       fn: () => {
      //         childMesh.isVisibleSelf =true;
      //         child.worldPosition =pos;
      //         child.worldRotation = rot;
      //       },
      //     });
      //   }


      //   } else if (type === 5 && WaterZoneIndex < WaterZoneChildren.length) {
      //     const w = this.getCellWallsEdgeAware(x, y);
      //     const isHorizontalCorridor = w.up && w.down && !w.left && !w.right;
      //     const isVerticalCorridor = w.left && w.right && !w.up && !w.down;
      //     const wallInfo = this.getWallInfo({ x, y });
      //     const child = WaterZoneChildren[WaterZoneIndex++].getComponent(TransformComponent);
      //     // if( this.props.Water1)
      //     //         this.props.Water1.visible.set(false); // 보일지 여부
      //     // if( this.props.Water2)
      //     //         this.props.Water2.visible.set(false); // 보일지 여부

      //     //  child.visible.set(true);
      //     //     //child.collidable.set(true);
      //     //  child.position.set(pos);  

      //     if (child) {
      //       //   this.delayedPlacements.push({
      //       //   fn: () => {
      //       //    if( this.props.Water1)
      //       //       this.props.Water1.visible.set(true); // 보일지 여부
      //       //   if( this.props.Water2)
      //       //       this.props.Water2.visible.set(true); // 보일지 여부


      //       //  this.async.setTimeout(() => {
      //       //   if( this.props.Water1)
      //       //           this.props.Water1.visible.set(true); // 보일지 여부
      //       //   if( this.props.Water2)
      //       //           this.props.Water2.visible.set(true); // 보일지 여부
                
      //       // }, 3000);
                 
      //       //   },
      //       // });
      //       //child.visible.set(true);
      //           //child.collidable.set(true);
      //       //child.position.set(pos);  
            
      //       // child.visible.set(true);
      //       // //child.collidable.set(true);
      //       // child.position.set(pos);

      //       if (isHorizontalCorridor) child.worldRotation =(Quaternion.fromEuler(new Vec3(0, 90, 0)));
      //       else if (isVerticalCorridor) child.worldRotation =(Quaternion.fromEuler(new Vec3(0, 0, 0)));
      //       else child.worldRotation =(Quaternion.fromEuler(new Vec3(0, 0, 0)));
      //     }
      //   } else if (type === 6 && SafeZoneIndex < SafeZoneChildren.length) {
      //     const child = SafeZoneChildren[SafeZoneIndex++].getComponent(TransformComponent);
      //     const childMesh = SafeZoneChildren[SafeZoneIndex].getComponent(MeshComponent);
      //     const childCol = SafeZoneChildren[SafeZoneIndex].getComponent(ColliderComponent);
      //     if(childCol && childMesh)
      //     {
      //     childMesh.isVisibleSelf = true;
      //     childCol.collisionLayer =2;
      //     }
      //     //let pos1 = pos;
      //     //pos1.y = 0.1;
      //     if(child && childCol && childMesh)
      //     {
      //     child.worldPosition = (new Vec3(pos.x, pos.y + 0.1, pos.z));
      //     // x,y는 셀 인덱스
      //     // 안전한 접근 헬퍼
      //     const inV = (xi: number, yi: number) => xi >= 0 && yi >= 0 && xi < verticalWalls.length && yi < verticalWalls[0].length;

      //     const inH = (xi: number, yi: number) => xi >= 0 && yi >= 0 && xi < horizontalWalls.length && yi < horizontalWalls[0].length;

      //     // 벽 여부(프로젝트의 WallType에 맞게 조정)
      //     const isWall = (v: any) => v !== WallType.None; // 숫자면 v !== 0, 불리언이면 !!v

      //     const right = inV(x, y) && isWall(verticalWalls[x][y]); // 셀의 오른쪽 벽
      //     const left = inV(x - 1, y) && isWall(verticalWalls[x - 1][y]); // 셀의 왼쪽 벽
      //     const down = inH(x, y) && isWall(horizontalWalls[x][y]); // 셀의 아래쪽 벽
      //     const up = inH(x, y - 1) && isWall(horizontalWalls[x][y - 1]); // 셀의 위쪽 벽

      //     // 기본값 없음: 벽이 있을 때만 회전
      //     let yaw: number | null = null;
      //     // 우선순위: 오른쪽 → 아래 → 왼쪽 → 위
      //     let nowstate;
      //     if (right) {
      //       yaw = 0;
      //       nowstate = "right";
      //     } else if (down) {
      //       yaw = -90;
      //       nowstate = "down";
      //     } else if (left) {
      //       yaw = -180;
      //       nowstate = "left";
      //     } else if (up) {
      //       nowstate = "up";
      //       yaw = 270;
      //       childMesh.isVisibleSelf =false;

      //       child.worldPosition =(new Vec3(0, 0, 100));
      //     } else {
            
      //       childMesh.isVisibleSelf = false;
      //       child.worldPosition = new Vec3(0, 0, 100);
      //     }
          

      //     //console.log("nowstate"+nowstate);
      //     //console.log("yaw"+yaw);
      //     if (yaw !== null && child) child.worldRotation =(Quaternion.fromEuler(new Vec3(0, yaw, 0)));
      //   }
      //     //console.log("nowstate"+nowstate +"/yaw"+yaw+"/child"+child.rotation.get());
      //   } else if (type === 8 && monsterIndex < MonsterChildren.length) {
      //     const child = MonsterChildren[monsterIndex++];

      //     const grid = { x, y };
      //     const world = new Vec3(x * cs, 0, y * cs).add(origin);
      //     const pos = new Vec2(x, y);
      //    // let timer = (this.props.startDelaySeconds -5) * 1000 ;
      //     if (child) {
      //       // this.async.setTimeout(() => {
      //       //   this.sendNetworkEvent(child, Events.npcInit, { pos });
      //       //   this.monsterSpots.push(pos);

      //       //   //child.visible.set(true);
      //       //   //child.collidable.set(true);
      //       //   //child.position.set(pos);
      //       //   //console.log("monster world" + pos);
      //       // }, timer);
      //     }
      //   }
      }
    }

    // === 가로벽 ===
    let hWallIndex = 0;
    let mWallIndexA = 0;

    
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height - 1; y++) {
        const type = horizontalWalls[x][y];

        const wall = this.horizontalWalls?.getChildren();
        //const wall = this.horizontalWallsEnt?.children.get();
        const pos = new Vec3(x * cs, 0, y * cs).add(origin).add(new Vec3(cs / 2, 0, 0));
        const childAtIndex = wall?.[hWallIndex].getComponent(MeshComponent);
        //const childAtIndexcol = wall?.[hWallIndex].getComponent(ColliderComponent);
        hWallIndex++;
        if (childAtIndex ) {
          childAtIndex.isVisibleSelf = (horizontalWalls[x][y] === WallType.Normal);
          //if((horizontalWalls[x][y] === WallType.Normal))
            //childAtIndexcol.collisionLayer = 2;
        }

        /*if (type === WallType.Moving || type === WallType.MgReovinv) 
        {
      const movingWall = movingWallAs[mWallIndexA++];
      if (movingWall) {
        movingWall.visible.set(true);
        movingWall.collidable.set(true);
        movingWall.position.set(pos); // 수평 벽 기준 위치 오프셋
        if(type === WallType.Moving)
         movingWall.rotation.set(hz.Quaternion.fromEuler(new hz.Vec3(0, 90, 0))); // 수평 벽 기준 위치 오프셋
        else  movingWall.rotation.set(hz.Quaternion.fromEuler(new hz.Vec3(0, -90, 0))); // 수평 벽 기준 위치 오프셋
      }
    }
    else
    {
      
      //if (!wall) continue;
      if(childAtIndex )
      {
         childAtIndex?.visible.set(horizontalWalls[x][y] === WallType.Normal);
         childAtIndex?.collidable.set(horizontalWalls[x][y] === WallType.Normal);
      }
    }*/
      }
    }

    // === 세로벽 ===
    let vWallIndex = 0;
    let mWallIndexB = 0;
    //const movingWallBs = this.props.movingWallParentB?.children.get() || [];
    for (let x = 0; x < width - 1; x++) {
      for (let y = 0; y < height; y++) {
        const type = verticalWalls[x][y];
        const wall = this.verticalWalls?.getChildren();
        //const wall = this.verticalWallsEnt?.children.get();
        const childAtIndex = wall?.[vWallIndex].getComponent(MeshComponent);
       
        const pos = new Vec3(x * cs, 0, y * cs).add(origin).add(new Vec3(0, 0, cs / 2));
        vWallIndex++;
        if (childAtIndex ) {
          childAtIndex.isVisibleSelf = (verticalWalls[x][y] === WallType.Normal);
          // if(verticalWalls[x][y] === WallType.Normal)
          // childAtIndexCol.collisionLayer =2;
        }
        //if (!wall) continue;
        /*if (type === WallType.Moving ||type === WallType.MovingRev ) {
      const movingWall = movingWallBs[mWallIndexB++];
      if (movingWall) {
        movingWall.visible.set(true);
        movingWall.collidable.set(true);
        
        movingWall.position.set(pos); // 수평 벽 기준 위치 오프셋
        if(type === WallType.MovingRev)
         movingWall.rotation.set(hz.Quaternion.fromEuler(new hz.Vec3(0, 180, 0))); // 수평 벽 기준 위치 오프셋
      }
    }
    else
    {
       if(childAtIndex)
       {
         childAtIndex?.visible.set(verticalWalls[x][y] === WallType.Normal);
          childAtIndex?.collidable.set(verticalWalls[x][y] === WallType.Normal);
       }
    }*/
      }
    }
  }

  //#endregion




  //#region Util Func
  getWallInfo(pos: { x: number; y: number }) {
    const up = pos.y < this.height - 1 && horizontalWalls[pos.x][pos.y];
    const down = pos.y > 0 && horizontalWalls[pos.x][pos.y - 1];
    const left = pos.x > 0 && verticalWalls[pos.x - 1][pos.y];
    const right = pos.x < this.width - 1 && verticalWalls[pos.x][pos.y];
    return { up, down, left, right };
  }


  private getCellWallsEdgeAware(x: number, y: number) {
      const W = this.width,
        H = this.height;

      const up = y >= H - 1 ? true : (horizontalWalls[x]?.[y] ?? WallType.Normal) !== WallType.None;

      const down = y <= 0 ? true : (horizontalWalls[x]?.[y - 1] ?? WallType.Normal) !== WallType.None;

      const right = x >= W - 1 ? true : (verticalWalls[x]?.[y] ?? WallType.Normal) !== WallType.None;

      const left = x <= 0 ? true : (verticalWalls[x - 1]?.[y] ?? WallType.Normal) !== WallType.None;

      return { up, down, left, right };
    }


  private isStraightCorridorAt(x: number, y: number): boolean {
    const w = this.getCellWallsEdgeAware(x, y); // true = 벽
    const isH = w.up && w.down && !w.left && !w.right; // 좌우 열림 + 상하 벽
    const isV = w.left && w.right && !w.up && !w.down; // 상하 열림 + 좌우 벽
    return isH || isV;
  }
  
  private inBounds(x: number, y: number) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  // 안전 체크 + 덮어쓰기 방지
  private canPlaceAt(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    // 바닥은 1(길)이어야만 설치 (원 규칙)
    return tileType[x]?.[y] === 1;
  }

  printMatrix(matrix: any[][]) {
    const str = matrix.map((row) => row.map((cell) => (cell === true ? "1" : cell === false ? "0" : cell)).join("  ")).join("\n");
    //console.log(str);
  }
  //  if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && !visited[nx][ny])
  getUnvisitedNeighbors(pos: { x: number; y: number }, visited: boolean[][], width: number, height: number): { x: number; y: number }[] {
    const dirs = [
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];
    const neighbors: { x: number; y: number }[] = [];
    for (const d of dirs) {
      const nx = pos.x + d.x;
      const ny = pos.y + d.y;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[nx][ny]) {
        neighbors.push({ x: nx, y: ny });
      }
    }
    return neighbors;
  }

  removeWall(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 1) verticalWalls[a.x][a.y] = WallType.None;
    else if (dx === -1) verticalWalls[b.x][b.y] = WallType.None;
    else if (dy === 1) horizontalWalls[a.x][a.y] = WallType.None;
    else if (dy === -1) horizontalWalls[a.x][b.y] = WallType.None;
  }
  getRandomUniquePrefab(list: Asset[]): Asset | null {
    if (list.length === 0) return null;

    // 리스트를 복사하고 셔플
    const shuffled = [...list];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.pop() ?? null;
  }
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  // === 유틸: 이름 기준으로 자식 엔티티들을 그룹(큐)으로 묶기 ===
  private groupByName(children: Entity[]) {
    const map = new Map<string, Entity[]>();
    for (const c of children) {
      const key = c.name.toString?.() ?? "unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    // 각 큐를 셔플해 랜덤성 유지
    for (const [k, arr] of Array.from(map.entries())) {
      this.shuffle(arr);
    }
    return map;
  }
   isFarEnough(pos: { x: number; y: number }, list: { x: number; y: number }[], minDist = 1): boolean {
    return list.every((p) => {
      const dx = p.x - pos.x;
      const dy = p.y - pos.y;
      return dx * dx + dy * dy >= minDist * minDist;
    });
  }
  // 새로 추가
  wouldMakeOpen2x2(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
    // a→b 벽을 제거하고 b를 길(1)로 만든 상황을 가정해
    // (b를 꼭짓점으로 하는) 2×2 평면이 전부 길이 되는 경우가 생기는지 체크
    const isPath = (x: number, y: number) => this.inBounds(x, y) && (tileType[x]?.[y] === 1 || (x === b.x && y === b.y));
    // b 주변 2×2 네 방향 검사
    for (const dx of [0, -1])
      for (const dy of [0, -1]) {
        const x0 = b.x + dx,
          y0 = b.y + dy;
        if (!this.inBounds(x0, y0) || !this.inBounds(x0 + 1, y0 + 1)) continue;
        // a↔b 사이가 실제로 연결되는지(벽이 없어지는지)도 전제
        // 이미 길인 세 칸 + b(가정상 길)이면 2×2 오픈 방
        const c1 = isPath(x0, y0);
        const c2 = isPath(x0 + 1, y0);
        const c3 = isPath(x0, y0 + 1);
        const c4 = isPath(x0 + 1, y0 + 1);
        if (c1 && c2 && c3 && c4) return true;
      }
    return false;
  }
  
  hasWallBetween(a: { x: number; y: number }, b: { x: number; y: number }): WallType {
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    // b는 a의 오른쪽
    if (dx === 1 && dy === 0) return verticalWalls[a.x][a.y];
    // b는 a의 왼쪽
    if (dx === -1 && dy === 0) return verticalWalls[b.x][b.y];
    // b는 a의 아래쪽
    if (dx === 0 && dy === 1) return horizontalWalls[a.x][a.y];
    // b는 a의 위쪽
    if (dx === 0 && dy === -1) return horizontalWalls[a.x][b.y]; // or a.y - 1

    return WallType.Normal; // not adjacent
  }
 
  isInnerCell(x: number, y: number): boolean {
    const W = this.width,
      H = this.height;
    return x > 0 && y > 0 && x < W - 1 && y < H - 1;
  }

    //#endregion


}
