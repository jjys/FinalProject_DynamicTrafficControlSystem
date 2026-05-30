import json
import matplotlib.pyplot as plt

log_file = 'logs/metrics_log_1779978916628.jsonl'
output_image = 'doc/ab_test_comparison.png'

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
plt.plot(ai_congested, label='AI Smart Lights', color='blue', alpha=0.8)

plt.title('A/B Testing: Congested Vehicles Over Time')
plt.xlabel('Time (Seconds)')
plt.ylabel('Number of Congested Vehicles')
plt.legend()
plt.grid(True, linestyle='--', alpha=0.6)

plt.savefig(output_image)
print(f"Chart saved to {output_image}")
