# VSR GCP Deployment with Pulumi

## Overview
This Pulumi configuration deploys the VSR application to Google Cloud Platform with:
- Load Balancer for domain-based routing
- Single VM instance running Docker Compose
- Support for separate frontend and backend domains
- Automatic Ollama model initialization

## Prerequisites

1. **Install required tools:**
```bash
# Install Pulumi
curl -fsSL https://get.pulumi.com | sh

# Install Google Cloud SDK
brew install google-cloud-sdk  # macOS
# Or follow: https://cloud.google.com/sdk/docs/install

# Install Node.js and pnpm
brew install node
npm install -g pnpm
```

2. **Set up GCP:**
```bash
# Authenticate with GCP
gcloud auth login
gcloud auth application-default login

# Create or select project
gcloud projects create YOUR_PROJECT_ID --name="VSR Demo"
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable compute.googleapis.com
gcloud services enable dns.googleapis.com
```

## Configuration

1. **Install dependencies:**
```bash
cd pulumi
pnpm install
```

2. **Initialize Pulumi stack:**
```bash
pulumi stack init production
```

3. **Configure required settings:**
```bash
# GCP settings
pulumi config set gcp:project YOUR_PROJECT_ID
pulumi config set gcp:region asia-northeast1
pulumi config set gcp:zone asia-northeast1-a

# Domain settings
pulumi config set frontendDomain vsr-demo.tidequest.net
pulumi config set backendDomain vsr-api.tidequest.net

# Optional: for private repos
pulumi config set --secret githubToken YOUR_GITHUB_TOKEN
```

## Deployment

1. **Preview changes:**
```bash
pulumi preview
```

2. **Deploy infrastructure:**
```bash
pulumi up
```

3. **Get deployment information:**
```bash
# Get all outputs
pulumi stack output

# Get specific values
pulumi stack output loadBalancerIp
pulumi stack output instanceIp
```

## Post-Deployment Setup

### 1. Configure DNS
Point both domains to the Load Balancer IP:
```bash
# Get the Load Balancer IP
LB_IP=$(pulumi stack output loadBalancerIp)
echo "Configure DNS for:"
echo "  - vsr-demo.tidequest.net -> $LB_IP"
echo "  - vsr-api.tidequest.net -> $LB_IP"
```

### 2. Verify Deployment
```bash
# SSH into the instance
gcloud compute ssh vsr-instance --zone=asia-northeast1-a

# Check Docker Compose status
sudo docker-compose -f /opt/vsr/docker-compose.yml ps

# View startup logs
sudo tail -f /var/log/startup-script.log

# Check individual services
sudo docker logs zksteam_backend
sudo docker logs zksteam_frontend
sudo docker logs zksteam_ollama
```

### 3. Enable HTTPS (Optional but Recommended)
```bash
# Create managed SSL certificate
gcloud compute ssl-certificates create vsr-ssl-cert \
  --domains=vsr-demo.tidequest.net,YOUR_BACKEND_DOMAIN \
  --global

# The Pulumi configuration will need to be updated to use HTTPS proxy
```

## Environment Variables
The startup script automatically creates a `.env` file with default values. To customize:

```bash
# SSH into the instance
gcloud compute ssh vsr-instance --zone=asia-northeast1-a

# Edit the environment file
sudo nano /opt/vsr/.env

# Restart services
cd /opt/vsr
sudo docker-compose down
sudo docker-compose up -d
```

## Monitoring

### Check Service Health
```bash
# Frontend
curl -I http://vsr-demo.tidequest.net

# Backend
curl -I http://vsr-api.tidequest.net/health

# Ollama
gcloud compute ssh vsr-instance --zone=asia-northeast1-a \
  --command="curl http://localhost:11434/api/tags"
```

### View Logs
```bash
# All services
gcloud compute ssh vsr-instance --zone=asia-northeast1-a \
  --command="sudo docker-compose -f /opt/vsr/docker-compose.yml logs -f"

# Specific service
gcloud compute ssh vsr-instance --zone=asia-northeast1-a \
  --command="sudo docker logs -f zksteam_backend"
```

## Troubleshooting

### Ollama Model Not Loading
```bash
# Re-run initialization
gcloud compute ssh vsr-instance --zone=asia-northeast1-a
cd /opt/vsr
sudo rm .ollama-initialized
sudo docker-compose --profile init up ollama-init
sudo docker-compose restart
```

### Services Not Starting
```bash
# Check startup script logs
gcloud compute ssh vsr-instance --zone=asia-northeast1-a \
  --command="sudo tail -100 /var/log/startup-script.log"

# Manually restart
cd /opt/vsr
sudo docker-compose down
sudo docker-compose up -d
```

### DNS Not Resolving
1. Verify DNS records are pointing to Load Balancer IP
2. Wait for DNS propagation (can take up to 48 hours)
3. Test with: `nslookup vsr-demo.tidequest.net`

## Cleanup

To destroy all resources:
```bash
pulumi destroy
```

## Cost Estimation
- **VM (e2-standard-2, 8GB RAM, 100GB disk)**: ~$50/month
- **Load Balancer**: ~$18/month
- **Static IPs**: ~$7/month
- **Network egress**: Variable based on usage
- **Total**: ~$75-85/month

## Security Considerations
1. Update default passwords in `.env` file
2. Configure firewall rules to restrict access
3. Enable HTTPS with SSL certificates
4. Regular security updates on the VM
5. Monitor access logs

## Support
For issues or questions:
- Check logs: `sudo tail -f /var/log/startup-script.log`
- Docker status: `sudo docker-compose ps`
- Network connectivity: `curl -v http://localhost:3000/health`