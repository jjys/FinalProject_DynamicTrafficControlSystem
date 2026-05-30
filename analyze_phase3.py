import json
import glob
import os
import matplotlib.pyplot as plt

# 1. Find the latest metrics log
metrics_files = glob.glob('logs/metrics_log_*.jsonl')
if not metrics_files:
    print("No metrics logs found.")
    exit(1)
latest_metrics = max(metrics_files, key=os.path.getctime)

data = []
with open(latest_metrics, 'r') as f:
    for line in f:
        try:
            data.append(json.loads(line))
        except:
            pass

# Find the last block of 'fixed'
fixed_block = []
for d in reversed(data):
    if d['mode'] == 'fixed':
        fixed_block.append(d)
    elif len(fixed_block) > 0:
        break
fixed_block.reverse()

# Find the last block of 'ai' before the fixed block
ai_block = []
found_ai = False
for d in reversed(data):
    if len(fixed_block) > 0 and d['timestamp'] >= fixed_block[0]['timestamp']:
        continue
    
    if d['mode'] == 'ai':
        ai_block.append(d)
        found_ai = True
    elif found_ai:
        break
ai_block.reverse()

if len(ai_block) == 0 or len(fixed_block) == 0:
    print("Could not find both AI and Fixed blocks.")
    exit(1)

# Truncate to the minimum length to make a fair comparison
min_len = min(len(ai_block), len(fixed_block))
ai_block = ai_block[:min_len]
fixed_block = fixed_block[:min_len]

# Normalize Time
t0_ai = ai_block[0]['timestamp']
t0_fixed = fixed_block[0]['timestamp']
time_ai = [(d['timestamp'] - t0_ai)/1000.0 for d in ai_block]
time_fixed = [(d['timestamp'] - t0_fixed)/1000.0 for d in fixed_block]

# Normalize Total Passed
pass0_ai = ai_block[0]['totalPassed']
pass0_fixed = fixed_block[0]['totalPassed']
pass_ai = [d['totalPassed'] - pass0_ai for d in ai_block]
pass_fixed = [d['totalPassed'] - pass0_fixed for d in fixed_block]

cong_ai = [d['congested'] for d in ai_block]
cong_fixed = [d['congested'] for d in fixed_block]

plt.figure(figsize=(12, 6))

# Subplot 1: Congestion (Lower is better)
plt.subplot(1, 2, 1)
plt.plot(time_ai, cong_ai, label='AI Smart Lights', color='blue', linewidth=2)
plt.plot(time_fixed, cong_fixed, label='Fixed Timer', color='red', linestyle='--', linewidth=2)
plt.title('Phase 3 A/B Test: Congestion Over Time (3x3 Grid)')
plt.xlabel('Time (seconds)')
plt.ylabel('Number of Congested Vehicles')
plt.legend()
plt.grid(True, alpha=0.3)

# Subplot 2: Total Passed (Higher is better)
plt.subplot(1, 2, 2)
plt.plot(time_ai, pass_ai, label='AI Smart Lights', color='blue', linewidth=2)
plt.plot(time_fixed, pass_fixed, label='Fixed Timer', color='red', linestyle='--', linewidth=2)
plt.title('Phase 3 A/B Test: Total Throughput (3x3 Grid)')
plt.xlabel('Time (seconds)')
plt.ylabel('Cumulative Cars Passed')
plt.legend()
plt.grid(True, alpha=0.3)

plt.tight_layout()
output_path = 'phase3_ab_test.png'
plt.savefig(output_path, dpi=300)
print(f"Plot saved to {output_path} with {min_len} seconds of data.")
