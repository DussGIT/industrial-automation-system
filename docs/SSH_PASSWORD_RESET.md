# SSH Password Reset for UP Board

## Problem: Cannot Authenticate with SSH

### Option 1: Use Default Credentials

The UP Board typically comes with:
- **Username:** `upsquared`
- **Password:** `upsquared`

Try:
```powershell
ssh upsquared@YOUR_BOARD_IP
# When prompted, type: upsquared
```

### Option 2: Try Other Common Credentials

```powershell
# Try root
ssh root@YOUR_BOARD_IP
# Passwords to try: root, password, toor, admin

# Try other usernames
ssh ubuntu@YOUR_BOARD_IP
ssh pi@YOUR_BOARD_IP
```

### Option 3: Reset Password via Physical Access

If you have a monitor and keyboard connected to the UP board:

#### Method A: From logged-in session
```bash
# If you're logged in at the console, change the password:
passwd
# Then enter new password twice

# Or change for a specific user:
sudo passwd upsquared
```

#### Method B: Using GRUB boot menu (if locked out)

1. Reboot the UP board
2. When GRUB menu appears, press `e` to edit
3. Find the line starting with `linux` 
4. Add `init=/bin/bash` at the end of that line
5. Press `Ctrl+X` or `F10` to boot
6. Once you get a shell prompt:
   ```bash
   # Remount filesystem as read-write
   mount -o remount,rw /
   
   # Change password
   passwd upsquared
   
   # Or create a new user
   useradd -m -s /bin/bash newuser
   passwd newuser
   usermod -aG sudo newuser
   
   # Reboot
   exec /sbin/init
   ```

### Option 4: Enable SSH Key Authentication

This bypasses password issues entirely.

#### On Windows:
```powershell
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "your_email@example.com"

# The key will be saved to: C:\Users\YourUsername\.ssh\id_ed25519
```

#### On UP Board (via console/monitor):
```bash
# Create .ssh directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Create authorized_keys file
nano ~/.ssh/authorized_keys
```

Copy your public key from Windows:
```powershell
# View your public key
type $env:USERPROFILE\.ssh\id_ed25519.pub
```

Paste it into the authorized_keys file on the UP board, then:
```bash
chmod 600 ~/.ssh/authorized_keys

# Ensure SSH config allows key authentication
sudo nano /etc/ssh/sshd_config
```

Verify these settings:
```
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
```

Restart SSH:
```bash
sudo systemctl restart ssh
```

Now from Windows, you can connect without a password:
```powershell
ssh upsquared@YOUR_BOARD_IP
```

### Option 5: Check SSH Server Configuration

If you can access the board console, check SSH settings:

```bash
# View SSH config
sudo cat /etc/ssh/sshd_config | grep -i password

# Ensure password authentication is enabled
sudo nano /etc/ssh/sshd_config
```

Required settings for password authentication:
```
PasswordAuthentication yes
PermitRootLogin yes
ChallengeResponseAuthentication yes
UsePAM yes
```

After changes:
```bash
# Test configuration
sudo sshd -t

# Restart SSH
sudo systemctl restart ssh

# Check status
sudo systemctl status ssh
```

### Option 6: Check Authentication Logs

On the UP board, monitor authentication attempts:

```bash
# Watch authentication log in real-time
sudo tail -f /var/log/auth.log

# Or check recent failures
sudo grep "Failed password" /var/log/auth.log | tail -20

# Check SSH daemon log
sudo journalctl -u ssh -f
```

### Option 7: Factory Reset / Reinstall OS

If all else fails and you have physical access:

1. Download Ubuntu for UP Board from: https://downloads.up-community.org/
2. Create bootable USB using Rufus or Etcher
3. Boot from USB and reinstall
4. During installation, set a password you'll remember
5. After installation:
   ```bash
   sudo apt update
   sudo apt install openssh-server
   sudo systemctl enable ssh
   sudo systemctl start ssh
   ```

## Quick Diagnostic Commands

### From Windows (to test connectivity):
```powershell
# Test if board is reachable
Test-Connection -ComputerName YOUR_BOARD_IP -Count 4

# Test if SSH port is open
Test-NetConnection -ComputerName YOUR_BOARD_IP -Port 22

# Connect with verbose output
ssh -v upsquared@YOUR_BOARD_IP

# Try with different authentication methods
ssh -o PreferredAuthentications=password upsquared@YOUR_BOARD_IP
ssh -o PreferredAuthentications=keyboard-interactive upsquared@YOUR_BOARD_IP
```

### From UP Board Console:
```bash
# Check SSH is running
sudo systemctl status ssh

# Check SSH is listening
sudo netstat -tlnp | grep :22
# or
sudo ss -tlnp | grep :22

# Test SSH locally
ssh localhost

# Check user exists
id upsquared
grep upsquared /etc/passwd

# Check if account is locked
sudo passwd -S upsquared
```

## Common Issues

### Issue: "Permission denied (publickey)"
**Solution:** Enable password authentication in `/etc/ssh/sshd_config`

### Issue: "Host key verification failed"
**Solution:** 
```powershell
ssh-keygen -R YOUR_BOARD_IP
```

### Issue: "Connection refused"
**Solution:** SSH service isn't running
```bash
sudo systemctl start ssh
sudo systemctl enable ssh
```

### Issue: "No route to host"
**Solution:** 
- Check network cable/WiFi
- Verify IP address: `ip addr show`
- Check firewall: `sudo ufw status`

### Issue: Account locked after too many failed attempts
**Solution:** From console:
```bash
sudo faillock --user upsquared --reset
```

## Getting Help

If you're still stuck:
1. Connect monitor/keyboard to UP board
2. Log in at console
3. Run: `sudo journalctl -u ssh -n 50`
4. Look for error messages
5. Check `/var/log/auth.log` for authentication failures
