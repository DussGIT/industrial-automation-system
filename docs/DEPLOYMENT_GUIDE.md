# Deploying to UP Board

## Quick SSH Connection Test

```powershell
# Test connection
.\deploy-to-board.ps1 -TestConnection -BoardIP "192.168.1.100"

# Or just run interactively
.\deploy-to-board.ps1
```

## Common Issues and Solutions

### 1. SSH Connection Refused

**Symptoms:** `Connection refused` or timeout when trying to connect

**Solutions:**
```powershell
# On the UP board, enable SSH:
sudo systemctl enable ssh
sudo systemctl start ssh
sudo systemctl status ssh

# Check if SSH is listening on port 22:
sudo netstat -tlnp | grep 22

# Allow SSH through firewall:
sudo ufw allow 22
sudo ufw status
```

### 2. SSH Client Not Found on Windows

**Solution:**
```powershell
# Install OpenSSH Client
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0

# Verify installation
ssh -V
```

### 3. Permission Denied (publickey,password)

**Solutions:**
- Default UP board credentials: `upsquared` / `upsquared`
- Make sure password authentication is enabled in SSH config:

```bash
# On UP board, edit SSH config:
sudo nano /etc/ssh/sshd_config

# Ensure these lines are set:
PasswordAuthentication yes
PermitRootLogin yes  # if you need root access

# Restart SSH:
sudo systemctl restart ssh
```

### 4. Cannot Find UP Board IP Address

**Find the board's IP address:**

Option A - On the UP board directly:
```bash
ip addr show
# or
hostname -I
```

Option B - From your Windows PC (find all devices on network):
```powershell
# Scan local network (replace with your network range)
1..254 | ForEach-Object { 
    Test-Connection -ComputerName "192.168.1.$_" -Count 1 -Quiet 
} | Where-Object { $_ } 

# Or use arp
arp -a
```

Option C - Check your router's DHCP leases page

### 5. Host Key Verification Failed

**Solution:**
```powershell
# Remove old key from known_hosts
ssh-keygen -R 192.168.1.100

# Or connect with StrictHostKeyChecking=no (less secure)
ssh -o StrictHostKeyChecking=no upsquared@192.168.1.100
```

## Manual SSH Connection

If the script doesn't work, try connecting manually:

```powershell
# Basic connection
ssh upsquared@192.168.1.100

# With verbose output for debugging
ssh -v upsquared@192.168.1.100

# Specify port explicitly
ssh -p 22 upsquared@192.168.1.100
```

## Network Configuration on UP Board

If the UP board doesn't have an IP address or isn't connected to network:

### Using Network Manager (GUI)
1. Click network icon in system tray
2. Select your WiFi/Ethernet connection
3. Configure IP settings

### Using command line:
```bash
# Check current network status
ip addr show
nmcli device status

# For Ethernet (DHCP):
sudo nmcli con add type ethernet con-name eth0 ifname eth0

# For WiFi:
sudo nmcli dev wifi list
sudo nmcli dev wifi connect "YourSSID" password "YourPassword"

# Set static IP:
sudo nmcli con mod eth0 ipv4.addresses 192.168.1.100/24
sudo nmcli con mod eth0 ipv4.gateway 192.168.1.1
sudo nmcli con mod eth0 ipv4.dns "8.8.8.8"
sudo nmcli con mod eth0 ipv4.method manual
sudo nmcli con up eth0
```

## Using the Deployment Script

### Test connection only:
```powershell
.\deploy-to-board.ps1 -TestConnection -BoardIP "192.168.1.100" -BoardUser "upsquared"
```

### Install Docker:
```powershell
.\deploy-to-board.ps1 -InstallDocker -BoardIP "192.168.1.100"
```

### Deploy application:
```powershell
.\deploy-to-board.ps1 -Deploy -BoardIP "192.168.1.100"
```

### Full setup (all steps):
```powershell
.\deploy-to-board.ps1 -BoardIP "192.168.1.100"
# Then choose option 4
```

## After Successful Deployment

Access your application:
- Frontend UI: `http://192.168.1.100:5173`
- Backend API: `http://192.168.1.100:3000/api`
- Health Check: `http://192.168.1.100:3000/health`

View logs:
```powershell
ssh upsquared@192.168.1.100 "cd ~/industrial-automation && docker compose logs -f"
```

Manage containers:
```powershell
# Stop
ssh upsquared@192.168.1.100 "cd ~/industrial-automation && docker compose stop"

# Start
ssh upsquared@192.168.1.100 "cd ~/industrial-automation && docker compose start"

# Restart
ssh upsquared@192.168.1.100 "cd ~/industrial-automation && docker compose restart"

# View status
ssh upsquared@192.168.1.100 "cd ~/industrial-automation && docker compose ps"
```

## Setting up SSH Keys (Optional, for passwordless login)

On your Windows machine:
```powershell
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy public key to UP board
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh upsquared@192.168.1.100 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"

# Now you can connect without password
ssh upsquared@192.168.1.100
```

## Troubleshooting Connection Issues

### Check if board is reachable:
```powershell
Test-Connection -ComputerName 192.168.1.100 -Count 4
# or
ping 192.168.1.100
```

### Check which services are running on board:
```powershell
# Scan common ports
Test-NetConnection -ComputerName 192.168.1.100 -Port 22  # SSH
Test-NetConnection -ComputerName 192.168.1.100 -Port 80  # HTTP
Test-NetConnection -ComputerName 192.168.1.100 -Port 443 # HTTPS
```

### Enable verbose SSH output:
```powershell
ssh -vvv upsquared@192.168.1.100
```

This will show detailed connection information and help identify where the connection is failing.
