export class QLearning {
  private qTable: Map<string, number[]>;
  private learningRate: number;
  private discountFactor: number;
  private epsilon: number; // Exploration rate
  private epsilonDecay: number;
  private minEpsilon: number;
  public totalReward: number = 0;
  public trainingEpisodes: number = 0;

  constructor(
    learningRate = 0.5,
    discountFactor = 0.9,
    epsilon = 1.0,
    epsilonDecay = 0.995,
    minEpsilon = 0.01
  ) {
    this.qTable = new Map();
    this.learningRate = learningRate;
    this.discountFactor = discountFactor;
    this.epsilon = epsilon;
    this.epsilonDecay = epsilonDecay;
    this.minEpsilon = minEpsilon;
  }

  // State is represented as a string: "phase-N-S-E-W"
  // e.g. "0-1-0-2-1"
  public getStateString(state: number[]): string {
    return state.join("-");
  }

  public getQValues(stateStr: string): number[] {
    if (!this.qTable.has(stateStr)) {
      // Initialize with 0 for both actions (0: keep, 1: switch)
      this.qTable.set(stateStr, [0, 0]);
    }
    return this.qTable.get(stateStr)!;
  }

  public getAction(state: number[]): number {
    if (Math.random() < this.epsilon) {
      return Math.random() < 0.5 ? 0 : 1; // Explore
    }

    const stateStr = this.getStateString(state);
    const qValues = this.getQValues(stateStr);
    
    // Exploit: return index of max Q-value
    if (qValues[0] > qValues[1]) return 0;
    if (qValues[1] > qValues[0]) return 1;
    // Tie breaker
    return Math.random() < 0.5 ? 0 : 1;
  }

  public learn(state: number[], action: number, reward: number, nextState: number[]): void {
    const stateStr = this.getStateString(state);
    const nextStateStr = this.getStateString(nextState);
    
    const qValues = this.getQValues(stateStr);
    const nextQValues = this.getQValues(nextStateStr);
    
    const maxNextQ = Math.max(nextQValues[0], nextQValues[1]);
    
    // Q-Learning update rule
    qValues[action] = qValues[action] + this.learningRate * (reward + this.discountFactor * maxNextQ - qValues[action]);
    
    this.qTable.set(stateStr, qValues);
    if (this.trainingEpisodes === 0) {
        this.totalReward = reward;
    } else {
        this.totalReward = this.totalReward * 0.95 + reward * 0.05;
    }
  }

  public endEpisode(): void {
    this.trainingEpisodes++;
    if (this.epsilon > this.minEpsilon) {
      this.epsilon *= this.epsilonDecay;
    }
  }

  public getEpsilon(): number {
    return this.epsilon;
  }

  public setEpsilon(val: number): void {
    this.epsilon = val;
  }

  public reset(): void {
    this.qTable.clear();
    this.epsilon = 1.0;
    this.totalReward = 0;
    this.trainingEpisodes = 0;
  }
}
