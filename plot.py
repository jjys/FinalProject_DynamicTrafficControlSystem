import json
import matplotlib.pyplot as plt
import numpy as np

log_file = 'logs/rl_log_1779977586185.jsonl'
output_image = 'C:/Users/jys-pc/.gemini/antigravity-ide/brain/05c7bff8-f4ab-44a4-af1c-f2b545b4430d/rl_performance_final.png'

episodes = []
rewards = {}
epsilons = {}

with open(log_file, 'r') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
            ep = data['episode']
            if ep not in rewards:
                rewards[ep] = []
                epsilons[ep] = []
                episodes.append(ep)
            rewards[ep].append(data['reward'])
            epsilons[ep].append(data['epsilon'])
        except json.JSONDecodeError:
            continue

# Aggregate by episode
ep_list = sorted(list(rewards.keys()))
avg_rewards = [np.mean(rewards[ep]) for ep in ep_list]
avg_epsilons = [np.mean(epsilons[ep]) for ep in ep_list]

# Moving average for rewards (window = 20)
def moving_average(a, n=20):
    ret = np.cumsum(a, dtype=float)
    ret[n:] = ret[n:] - ret[:-n]
    return ret[n - 1:] / n

ma_rewards = moving_average(avg_rewards, n=20)
ma_episodes = ep_list[19:]

fig, ax1 = plt.subplots(figsize=(10, 6))

color = 'tab:blue'
ax1.set_xlabel('Training Episodes (Time)')
ax1.set_ylabel('Average Reward (Moving Avg)', color=color)
ax1.plot(ma_episodes, ma_rewards, color=color, linewidth=2, label='Moving Avg Reward')
ax1.tick_params(axis='y', labelcolor=color)

# Second y-axis for Epsilon
ax2 = ax1.twinx()  
color = 'tab:red'
ax2.set_ylabel('Epsilon (Exploration Rate)', color=color)
ax2.plot(ep_list, avg_epsilons, color=color, linestyle='--', label='Epsilon')
ax2.tick_params(axis='y', labelcolor=color)

fig.tight_layout()
plt.title('Q-Learning AI Optimization over 15 Minutes')
plt.grid(True, alpha=0.3)
plt.savefig(output_image, dpi=150)
print(f'Chart saved to {output_image}')
