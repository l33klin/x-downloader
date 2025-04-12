#!/bin/bash
# Script to check for unrecognized PCI devices on a remote host
# Usage: ./check_pci_devices.sh [hostname] [username]

# Default values
HOSTNAME=${1:-"localhost"}
USERNAME=${2:-"$(whoami)"}

echo "===== PCI Device Detection Tool ====="
echo "Checking PCI devices on $HOSTNAME as $USERNAME"
echo "===================================="

# Function to run a command on the remote host and display the output
run_remote_command() {
    local command="$1"
    local description="$2"
    
    echo ""
    echo "===== $description ====="
    if [ "$HOSTNAME" = "localhost" ]; then
        eval "$command"
    else
        ssh "$USERNAME@$HOSTNAME" "$command"
    fi
    echo "===== End of $description ====="
}

# Get basic PCI device list
run_remote_command "lspci" "Basic PCI Device List"

# Get detailed PCI device information
run_remote_command "lspci -vvv" "Detailed PCI Device Information"

# Check for unrecognized devices
echo ""
echo "===== Checking for Unrecognized Devices ====="
if [ "$HOSTNAME" = "localhost" ]; then
    lspci -vvv | grep -i -E "unknown|unclaimed|no driver" || echo "No unrecognized devices found"
else
    ssh "$USERNAME@$HOSTNAME" "lspci -vvv | grep -i -E 'unknown|unclaimed|no driver'" || echo "No unrecognized devices found"
fi

# Check kernel messages for PCI issues
run_remote_command "dmesg | grep -i pci | grep -i -E 'error|warn|fail'" "PCI-related Kernel Messages (Errors/Warnings)"

# Check loaded kernel modules
run_remote_command "lsmod | head -20" "First 20 Loaded Kernel Modules"

# Generate a summary report
echo ""
echo "===== Summary Report ====="
if [ "$HOSTNAME" = "localhost" ]; then
    echo "Total PCI devices: $(lspci | wc -l)"
    echo "Potentially unrecognized devices: $(lspci -vvv | grep -i -E 'unknown|unclaimed|no driver' | wc -l)"
else
    echo "Total PCI devices: $(ssh "$USERNAME@$HOSTNAME" "lspci | wc -l")"
    echo "Potentially unrecognized devices: $(ssh "$USERNAME@$HOSTNAME" "lspci -vvv | grep -i -E 'unknown|unclaimed|no driver' | wc -l")"
fi

echo ""
echo "===== Recommendations ====="
echo "1. For any 'unknown device', note the vendor and device IDs (format: xxxx:xxxx)"
echo "2. Search for appropriate drivers based on these IDs"
echo "3. For 'unclaimed' devices, check if the appropriate kernel module is installed"
echo "4. Use 'modprobe' to load missing kernel modules"
echo "5. Check system logs for more detailed error messages: journalctl -b | grep -i pci"

echo ""
echo "===== End of Report ====="
