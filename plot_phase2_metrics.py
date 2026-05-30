import json
import matplotlib.pyplot as plt

log_file = 'logs/metrics_log_1780127854629.jsonl'
output_image = 'doc/phase2_ab_test_comparison.png'

fixed_congested = []
ai_congested = []

with open(log_file, 'r') as f:
    for line in f:
        data = json.loads(line)
        if data['mode'] == 'fixed':
            fixed_congested.append(data['congested'])
        elif data['mode'] == 'ai':
            ai_congested.append(data['congested'])

plt.figure(figsize=(10, 5))
plt.plot(fixed_congested, label='Fixed Timer (Control)', color='red', alpha=0.8)
plt.plot(ai_congested, label='Cooperative AI (Phase 2)', color='blue', alpha=0.8)

plt.title('Phase 2 A/B Testing: Congested Vehicles Over Time')
plt.xlabel('Time (Seconds)')
plt.ylabel('Number of Congested Vehicles')
plt.legend()
plt.grid(True, linestyle='--', alpha=0.6)

plt.savefig(output_image)
print(f"Chart saved to {output_image}")

# Also calculate some stats
print(f"Fixed Avg: {sum(fixed_congested)/len(fixed_congested) if fixed_congested else 0:.2f}")
print(f"Fixed Max: {max(fixed_congested) if fixed_congested else 0}")
print(f"AI Avg: {sum(ai_congested)/len(ai_congested) if ai_congested else 0:.2f}")
print(f"AI Max: {max(ai_congested) if ai_congested else 0}")
