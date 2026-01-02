#!/bin/bash
# SSH Diagnostic Script
# Run this on the UP board and share the output

echo "=========================================="
echo "SSH DIAGNOSTIC REPORT"
echo "=========================================="
echo ""

echo "=== 1. SSH Service Status ==="
systemctl status ssh --no-pager
echo ""

echo "=== 2. SSH Process Info ==="
ps aux | grep sshd
echo ""

echo "=== 3. Listening on Port 22 ==="
sudo ss -tlnp | grep :22
echo ""

echo "=== 4. /run/sshd Directory ==="
ls -ld /run/sshd 2>&1
echo ""

echo "=== 5. SSH Host Keys ==="
ls -la /etc/ssh/ssh_host_* 2>&1
echo ""

echo "=== 6. SSH Config (Important Lines) ==="
sudo grep -v "^#\|^$" /etc/ssh/sshd_config
echo ""

echo "=== 7. SSH Config Test ==="
sudo sshd -t 2>&1
echo ""

echo "=== 8. Recent SSH Logs (last 30 lines) ==="
sudo journalctl -u ssh -n 30 --no-pager
echo ""

echo "=== 9. Recent Auth Log (last 20 lines) ==="
sudo tail -20 /var/log/auth.log 2>&1
echo ""

echo "=== 10. TCP Wrappers ==="
echo "--- /etc/hosts.allow ---"
cat /etc/hosts.allow 2>&1
echo "--- /etc/hosts.deny ---"
cat /etc/hosts.deny 2>&1
echo ""

echo "=== 11. SSH Version ==="
sshd -V 2>&1
echo ""

echo "=== 12. System Info ==="
uname -a
echo ""

echo "=== 13. Network Interface Info ==="
ip addr show
echo ""

echo "=== 14. Firewall Status ==="
sudo ufw status 2>&1
sudo iptables -L -n 2>&1 | head -20
echo ""

echo "=== 15. User Info ==="
id supervisor
groups supervisor
echo ""

echo "=== 16. Recent System Messages ==="
sudo dmesg | tail -30
echo ""

echo "=========================================="
echo "END OF DIAGNOSTIC REPORT"
echo "=========================================="
