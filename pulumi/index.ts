import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

// Configuration
const config = new pulumi.Config();
const projectId = config.require("gcp:project");
const region = config.get("gcp:region") || "asia-northeast1";
const zone = config.get("gcp:zone") || "asia-northeast1-a";
const frontendDomain = config.get("frontendDomain") || "vsr-demo.tidequest.net";
const backendDomain = config.get("backendDomain") || "vsr-api.tidequest.net";
const githubToken = config.getSecret("githubToken"); // Optional for private repos

// Network configuration
const network = new gcp.compute.Network("vsr-network", {
    autoCreateSubnetworks: false,
});

const subnet = new gcp.compute.Subnetwork("vsr-subnet", {
    network: network.id,
    ipCidrRange: "10.0.0.0/24",
    region: region,
});

// Static IP addresses
const vmStaticIp = new gcp.compute.Address("vsr-vm-ip", {
    region: region,
});

const lbStaticIp = new gcp.compute.GlobalAddress("vsr-lb-ip", {});

// Firewall rules
const allowHttp = new gcp.compute.Firewall("allow-http", {
    network: network.selfLink,
    allows: [{
        protocol: "tcp",
        ports: ["80"],
    }],
    sourceRanges: ["0.0.0.0/0"],
    targetTags: ["http-server"],
});

const allowHttps = new gcp.compute.Firewall("allow-https", {
    network: network.selfLink,
    allows: [{
        protocol: "tcp",
        ports: ["443"],
    }],
    sourceRanges: ["0.0.0.0/0"],
    targetTags: ["https-server"],
});

const allowAppPorts = new gcp.compute.Firewall("allow-app-ports", {
    network: network.selfLink,
    allows: [
        {
            protocol: "tcp",
            ports: ["3000", "5173"],
        },
    ],
    sourceRanges: ["0.0.0.0/0"],
    targetTags: ["vsr-app"],
});

const allowHealthChecks = new gcp.compute.Firewall("allow-health-checks", {
    network: network.selfLink,
    allows: [{
        protocol: "tcp",
    }],
    sourceRanges: ["35.191.0.0/16", "130.211.0.0/22"],
    targetTags: ["allow-health-checks"],
});

// Startup script for VM
const startupScript = `#!/bin/bash
set -e

# Log all output
exec > >(tee -a /var/log/startup-script.log)
exec 2>&1

echo "Starting VSR deployment at $(date)"

# Update system
apt-get update
apt-get install -y git docker.io docker-compose

# Enable and start Docker
systemctl enable docker
systemctl start docker

# Clone repository
cd /opt
if [ ! -d "vsr" ]; then
    git clone https://github.com/TideQuest/vsr.git
fi
cd vsr

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    cat > .env <<EOF
# Database Configuration
POSTGRES_USER=zksteam
POSTGRES_PASSWORD=password123
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=zksteam_db
DATABASE_URL=postgresql://zksteam:password123@db:5432/zksteam_db

# Ollama Configuration
OLLAMA_MODEL=llama3.2:1b
OLLAMA_BASE_URL=http://ollama:11434

# Reclaim Protocol Configuration
RECLAIM_APP_ID=your_reclaim_app_id_here
RECLAIM_APP_SECRET=your_reclaim_app_secret_here
RECLAIM_PROVIDER_ID=your_provider_id_here

# ZKP Configuration
ZKP_MOCK=false

# Server Configuration
PORT=3000
NODE_ENV=production
CORS_ORIGIN=http://${frontendDomain},http://${backendDomain}

# Frontend Configuration
VITE_BACKEND_URL=http://${backendDomain}
VITE_WALLETCONNECT_PROJECT_ID=
EOF
fi

# Pull and initialize Ollama model (only on first run)
if [ ! -f /opt/vsr/.ollama-initialized ]; then
    echo "Initializing Ollama model..."
    docker-compose --profile init up ollama-init
    touch /opt/vsr/.ollama-initialized
    echo "Ollama model initialized"
fi

# Start all services with docker-compose
docker-compose up -d

echo "VSR deployment completed at $(date)"
`;

// Compute instance
const vsrInstance = new gcp.compute.Instance("vsr-instance", {
    machineType: "e2-medium",
    zone: zone,

    bootDisk: {
        initializeParams: {
            image: "ubuntu-os-cloud/ubuntu-2204-lts",
            size: 50,
            type: "pd-standard",
        },
    },

    networkInterfaces: [{
        network: network.id,
        subnetwork: subnet.id,
        accessConfigs: [{
            natIp: vmStaticIp.address,
        }],
    }],

    metadataStartupScript: startupScript,

    tags: ["http-server", "https-server", "vsr-app", "allow-health-checks"],

    serviceAccount: {
        scopes: [
            "https://www.googleapis.com/auth/compute.readonly",
            "https://www.googleapis.com/auth/devstorage.read_only",
            "https://www.googleapis.com/auth/logging.write",
            "https://www.googleapis.com/auth/monitoring.write",
        ],
    },

    labels: {
        environment: "production",
        application: "vsr",
    },

    scheduling: {
        preemptible: false,
        automaticRestart: true,
        onHostMaintenance: "MIGRATE",
    },
});

// Health check for frontend
const frontendHealthCheck = new gcp.compute.HealthCheck("frontend-health-check", {
    httpHealthCheck: {
        port: 5173,
        requestPath: "/",
    },
    checkIntervalSec: 10,
    timeoutSec: 5,
    healthyThreshold: 2,
    unhealthyThreshold: 3,
});

// Health check for backend
const backendHealthCheck = new gcp.compute.HealthCheck("backend-health-check", {
    httpHealthCheck: {
        port: 3000,
        requestPath: "/health",
    },
    checkIntervalSec: 10,
    timeoutSec: 5,
    healthyThreshold: 2,
    unhealthyThreshold: 3,
});

// Instance group
const instanceGroup = new gcp.compute.InstanceGroup("vsr-instance-group", {
    zone: zone,
    instances: [vsrInstance.selfLink],
    namedPorts: [
        {
            name: "frontend",
            port: 5173,
        },
        {
            name: "backend",
            port: 3000,
        },
    ],
});

// Backend service for frontend
const frontendBackendService = new gcp.compute.BackendService("frontend-backend-service", {
    protocol: "HTTP",
    portName: "frontend",
    timeoutSec: 30,
    healthChecks: frontendHealthCheck.selfLink,
    backends: [{
        group: instanceGroup.selfLink,
        balancingMode: "UTILIZATION",
        maxUtilization: 0.8,
    }],
});

// Backend service for API
const apiBackendService = new gcp.compute.BackendService("api-backend-service", {
    protocol: "HTTP",
    portName: "backend",
    timeoutSec: 30,
    healthChecks: backendHealthCheck.selfLink,
    backends: [{
        group: instanceGroup.selfLink,
        balancingMode: "UTILIZATION",
        maxUtilization: 0.8,
    }],
});

// URL maps
const urlMap = new gcp.compute.URLMap("vsr-url-map", {
    defaultService: frontendBackendService.selfLink,
    hostRules: [
        {
            hosts: [frontendDomain],
            pathMatcher: "frontend",
        },
        {
            hosts: [backendDomain],
            pathMatcher: "backend",
        },
    ],
    pathMatchers: [
        {
            name: "frontend",
            defaultService: frontendBackendService.selfLink,
        },
        {
            name: "backend",
            defaultService: apiBackendService.selfLink,
        },
    ],
});

// HTTPS proxy
const httpsProxy = new gcp.compute.TargetHttpsProxy("vsr-https-proxy", {
    urlMap: urlMap.selfLink,
    sslCertificates: [
        // Note: SSL certificates need to be created manually or via Cloud DNS
        // For now, using HTTP proxy
    ],
});

// HTTP proxy (for initial setup)
const httpProxy = new gcp.compute.TargetHttpProxy("vsr-http-proxy", {
    urlMap: urlMap.selfLink,
});

// Global forwarding rule
const httpForwardingRule = new gcp.compute.GlobalForwardingRule("vsr-http-forwarding-rule", {
    ipAddress: lbStaticIp.address,
    ipProtocol: "TCP",
    portRange: "80",
    target: httpProxy.selfLink,
});

// Outputs
export const instanceIp = vmStaticIp.address;
export const loadBalancerIp = lbStaticIp.address;
export const frontendUrl = pulumi.interpolate`http://${frontendDomain}`;
export const backendUrl = pulumi.interpolate`http://${backendDomain}`;
export const sshCommand = pulumi.interpolate`gcloud compute ssh vsr-instance --zone=${zone}`;
export const logsCommand = pulumi.interpolate`gcloud compute ssh vsr-instance --zone=${zone} --command="sudo tail -f /var/log/startup-script.log"`;

// Instructions
export const nextSteps = `
Next Steps:
1. Configure DNS:
   - Point ${frontendDomain} to ${lbStaticIp.address}
   - Point ${backendDomain} to ${lbStaticIp.address}

2. SSH into the instance to check status:
   ${pulumi.interpolate`gcloud compute ssh vsr-instance --zone=${zone}`}

3. Check docker-compose status:
   sudo docker-compose -f /opt/vsr/docker-compose.yml ps

4. View logs:
   sudo tail -f /var/log/startup-script.log

5. For HTTPS setup, create managed SSL certificates:
   gcloud compute ssl-certificates create vsr-ssl-cert \\
     --domains=${frontendDomain},${backendDomain} \\
     --global
`;