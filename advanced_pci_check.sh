#!/bin/bash
# Advanced script to check for unrecognized PCI devices on the local host
# This script helps identify PCI devices that may not be properly recognized by the system
# Usage: ./advanced_pci_check.sh

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print section headers
print_header() {
    echo -e "\n${BLUE}===== $1 =====${NC}"
}

# Function to run a command and display the output
run_command() {
    local command="$1"
    local description="$2"
    local show_empty="${3:-true}"

    print_header "$description"

    local output
    output=$(eval "$command" 2>&1)

    if [ -n "$output" ]; then
        echo "$output"
    elif [ "$show_empty" = "true" ]; then
        echo -e "${YELLOW}No output returned${NC}"
    fi
}

# Print script header
echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}      PCI Device Detection and Analysis Tool      ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo -e "Checking PCI devices on local host"
echo -e "${BLUE}=================================================${NC}"

# Get basic PCI device list
run_command "lspci" "Basic PCI Device List"

# Get detailed PCI device information
run_command "lspci -v" "Detailed PCI Device Information"

# Extract and display potentially problematic devices
print_header "Potentially Problematic Devices"
problematic=$(lspci -vvv | grep -B 5 -A 5 -i -E "unknown|unclaimed|no driver")

if [ -n "$problematic" ]; then
    echo -e "${YELLOW}Found potentially problematic devices:${NC}"
    echo "$problematic"
else
    echo -e "${GREEN}No problematic devices found. All PCI devices appear to be recognized correctly.${NC}"
fi

# Check for specific device classes that might be problematic
print_header "Analysis by Device Class"
device_classes=("VGA compatible controller" "Network controller" "Audio device" "USB controller")

for class in "${device_classes[@]}"; do
    devices=$(lspci -vvv | grep -A 10 "$class")

    if [ -n "$devices" ]; then
        echo -e "${BLUE}$class:${NC}"
        if echo "$devices" | grep -q -i -E "unknown|unclaimed|no driver"; then
            echo -e "${YELLOW}Issues detected with $class devices:${NC}"
            echo "$devices" | grep -i -E -B 2 -A 2 "unknown|unclaimed|no driver"
        else
            echo -e "${GREEN}All $class devices appear to be properly recognized${NC}"
        fi
        echo ""
    fi
done

# Check kernel messages for PCI issues
run_command "dmesg | grep -i pci | grep -i -E 'error|warn|fail'" "PCI-related Kernel Messages (Errors/Warnings)" "false"

# Check loaded kernel modules related to detected hardware
print_header "Hardware-Related Kernel Modules"
# Get a list of potential hardware-related modules
hw_modules=$(lspci -k | grep -i "kernel driver in use" | sort | uniq | awk '{print $5}')
for module in $hw_modules; do
    echo -e "${BLUE}Module:${NC} $module"
    modinfo "$module" | grep -E "description|author|license" | sed 's/^/  /'
    echo ""
done

# Show PCI device IDs for reference
print_header "PCI Device IDs"
echo -e "${YELLOW}Device IDs are useful for searching for drivers and troubleshooting${NC}"
lspci -nn | head -10
echo -e "${BLUE}(Showing first 10 devices only - use 'lspci -nn' to see all)${NC}"

# Generate a summary report
print_header "Summary Report"
total_devices=$(lspci | wc -l)
unrecognized=$(lspci -vvv | grep -i -E 'unknown|unclaimed|no driver' | wc -l)

echo -e "Total PCI devices: ${GREEN}$total_devices${NC}"
if [ "$unrecognized" -eq 0 ]; then
    echo -e "Potentially unrecognized devices: ${GREEN}$unrecognized${NC}"
    echo -e "${GREEN}All PCI devices appear to be properly recognized!${NC}"
else
    echo -e "Potentially unrecognized devices: ${RED}$unrecognized${NC}"
    echo -e "${YELLOW}Some devices may require driver installation or configuration.${NC}"
fi

print_header "Recommendations"
echo -e "1. For any ${YELLOW}'unknown device'${NC}, note the vendor and device IDs (format: xxxx:xxxx)"
echo -e "2. Search for appropriate drivers based on these IDs using: ${GREEN}lspci -n${NC}"
echo -e "3. For ${YELLOW}'unclaimed'${NC} devices, check if the appropriate kernel module is installed"
echo -e "4. Use ${GREEN}'sudo modprobe <module_name>'${NC} to load missing kernel modules"
echo -e "5. Check system logs for more detailed error messages: ${GREEN}journalctl -b | grep -i pci${NC}"
echo -e "6. For graphics cards issues, check: ${GREEN}sudo ubuntu-drivers devices${NC} (on Ubuntu systems)"
echo -e "7. For network cards, verify with: ${GREEN}ip link show${NC} and ${GREEN}rfkill list${NC}"
echo -e "8. To see detailed information about a specific PCI device: ${GREEN}lspci -vvv -s <bus_id>${NC}"
echo -e "9. To check available kernel modules for hardware: ${GREEN}find /lib/modules/\$(uname -r) -type f -name '*.ko*' | grep -i <device_name>${NC}"

echo -e "\n${BLUE}=================================================${NC}"
echo -e "${BLUE}                 End of Report                   ${NC}"
echo -e "${BLUE}=================================================${NC}"
