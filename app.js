
const state = {
  theme: 'dark',
  activeTab: 'ec2',
  selectedCliTab: 'aws',
  scanned: false,
  chartState: 'before', 
  costs: {
    compute: 7200,     
    storage: 4800,
    networking: 2250
  },
  savings: {
    ec2: 0,
    ebs: 0,
    eip: 0
  },
  selectedAction: null,
  ec2Instances: [
    { id: 'i-0ab12cd34ef567a1a', name: 'dev-backend-api', region: 'us-east-1', currentType: 't3.large', recommendedType: 't3.medium', cpuAvg: '1.8%', monthlyCost: 68, potentialSavings: 34, status: 'flagged' },
    { id: 'i-0cd23ef45gh678b2b', name: 'staging-redis-cache', region: 'us-west-2', currentType: 'r6i.xlarge', recommendedType: 'r6i.large', cpuAvg: '2.4%', monthlyCost: 252, potentialSavings: 126, status: 'flagged' },
    { id: 'i-0ef34gh56ij789c3c', name: 'prod-legacy-worker', region: 'us-east-1', currentType: 'c6i.2xlarge', recommendedType: 'c6i.large', cpuAvg: '3.1%', monthlyCost: 488, potentialSavings: 366, status: 'flagged' },
    { id: 'i-0ij45kl67mn890d4d', name: 'bi-report-generator', region: 'eu-west-1', currentType: 'm6g.2xlarge', recommendedType: 'm6g.xlarge', cpuAvg: '4.2%', monthlyCost: 312, potentialSavings: 156, status: 'flagged' },
    { id: 'i-0kl56mn78op901e5e', name: 'sandbox-testing-box', region: 'us-east-1', currentType: 't3.xlarge', recommendedType: 't3.nano', cpuAvg: '0.2%', monthlyCost: 136, potentialSavings: 131, status: 'flagged' }
  ],
  ebsVolumes: [
    { id: 'vol-01a23b45c67d89e01', name: 'temp-db-snapshot-backup', region: 'us-east-1', type: 'gp2', size: 500, iops: 1500, monthlyCost: 50, status: 'unattached' },
    { id: 'vol-02b34c56d78e90f02', name: 'legacy-app-disk-2024', region: 'us-east-1', type: 'gp2', size: 1000, iops: 3000, monthlyCost: 100, status: 'unattached' },
    { id: 'vol-03c45d67e89f01a03', name: 'unnamed-volume-prod', region: 'us-west-2', type: 'gp3', size: 250, iops: 3000, monthlyCost: 20, status: 'unattached' },
    { id: 'vol-04d56e78f90a12b04', name: 'scratch-fast-io-vol', region: 'eu-west-1', type: 'io2', size: 100, iops: 5000, monthlyCost: 160, status: 'unattached' }
  ],
  elasticIps: [
    { ip: '54.210.43.11', region: 'us-east-1', allocationId: 'eipalloc-01f23g45h67i89', idleTime: '12 days', monthlyCost: 7.30, status: 'idle' },
    { ip: '34.201.88.92', region: 'us-east-1', allocationId: 'eipalloc-02g34h56i78j90', idleTime: '34 days', monthlyCost: 7.30, status: 'idle' },
    { ip: '52.12.199.45', region: 'us-west-2', allocationId: 'eipalloc-03h45i67j89k01', idleTime: '7 days', monthlyCost: 7.30, status: 'idle' },
    { ip: '18.196.4.102', region: 'eu-central-1', allocationId: 'eipalloc-04i56j78k90l12', idleTime: '19 days', monthlyCost: 7.30, status: 'idle' }
  ]
};
const PricingMap = {
  't3.large': 68,
  't3.medium': 34,
  'r6i.xlarge': 252,
  'r6i.large': 126,
  'c6i.2xlarge': 488,
  'c6i.large': 122,
  'm6g.2xlarge': 312,
  'm6g.xlarge': 156,
  't3.xlarge': 136,
  't3.nano': 5,
};

let costChart = null;


document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.setAttribute('data-theme', state.theme);

  loadTagPreset('invalid');
  
  initCostChart();

  calculateRISavings();
  
  updateDashboardMetrics();
  renderAllTables();
});

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  
  if (costChart) {
    const textColor = state.theme === 'dark' ? '#9ca3af' : '#4b5563';
    costChart.options.plugins.legend.labels.color = textColor;
    costChart.update();
  }
  showToast('Theme Changed', `Switched dashboard to ${state.theme} mode`, 'success');
}

function triggerAuditScan() {
  const overlay = document.getElementById('scan-overlay');
  const consoleEl = document.getElementById('scan-console');
  const progressBar = document.getElementById('scan-progress-bar');
  const statusText = document.getElementById('scan-status-text');
  const scanBtn = document.getElementById('scan-btn-text');
  
  overlay.classList.remove('hidden');
  consoleEl.innerHTML = '';
  progressBar.style.width = '0%';
  
  const logs = [
    { text: 'Initializing AWS Secure token session (STS)...', delay: 300, type: 'info' },
    { text: 'STS Session established. Region: us-east-1. Role: CostAuditor', delay: 700, type: 'success' },
    { text: 'Scanning CloudWatch Metrics for CPU utilization across 42 active EC2 instances...', delay: 1200, type: 'info' },
    { text: 'Flagged 5 instances with CPU utilization consistently below 5% for >14 days.', delay: 1800, type: 'warning' },
    { text: 'Querying EC2 volume attachments in us-east-1, us-west-2, and eu-west-1...', delay: 2400, type: 'info' },
    { text: 'Found 4 unattached EBS volumes incurring billing fees.', delay: 2900, type: 'warning' },
    { text: 'Scanning Elastic IPs mapping tables...', delay: 3300, type: 'info' },
    { text: 'Found 4 unassociated Elastic IP addresses incurring idle penalties.', delay: 3800, type: 'warning' },
    { text: 'Aggregating data and generating optimization runbooks...', delay: 4300, type: 'info' },
    { text: 'Cost optimization audit scan complete! Dashboard updated.', delay: 4800, type: 'success' }
  ];

  let logIndex = 0;
  
  function processLog() {
    if (logIndex < logs.length) {
      const log = logs[logIndex];
      const entry = document.createElement('div');
      entry.className = `log-entry ${log.type}`;
      entry.textContent = `[${new Date().toLocaleTimeString()}] ${log.text}`;
      consoleEl.appendChild(entry);
      consoleEl.scrollTop = consoleEl.scrollHeight;
      
      // Update progress bar
      const pct = Math.floor(((logIndex + 1) / logs.length) * 100);
      progressBar.style.width = `${pct}%`;
      statusText.textContent = log.text;

      logIndex++;
      setTimeout(processLog, log.delay - (logIndex > 1 ? logs[logIndex-2].delay : 0));
    } else {
      setTimeout(() => {
        overlay.classList.add('hidden');
        state.scanned = true;
        scanBtn.textContent = 'Re-run Cost Audit';
        showToast('Audit Completed', 'Identified $3,850 in potential monthly cost savings.', 'success');
        updateDashboardMetrics();
      }, 500);
    }
  }

  processLog();
}

function getActiveCosts() {
  let activeCompute = state.costs.compute;
  let activeStorage = state.costs.storage;
  let activeNetworking = state.costs.networking;

  activeCompute -= state.savings.ec2;
  activeStorage -= state.savings.ebs;
  activeNetworking -= state.savings.eip;

  return {
    compute: Math.max(0, activeCompute),
    storage: Math.max(0, activeStorage),
    networking: Math.max(0, activeNetworking)
  };
}

function updateDashboardMetrics() {
  const current = getActiveCosts();
  const currentTotal = current.compute + current.storage + current.networking;
  
  // Overall baseline is always $14,250
  const baselineTotal = 14250;
  const currentSavings = baselineTotal - currentTotal;
  const savingsPct = ((currentSavings / baselineTotal) * 100).toFixed(1);
  
  // Render KPI values
  document.getElementById('val-current-spend').textContent = `$${currentTotal.toLocaleString()}`;
  document.getElementById('val-projected-savings').textContent = `$${currentSavings.toLocaleString()}`;
  document.getElementById('val-savings-pct').textContent = `${savingsPct}% Saved`;
  document.getElementById('target-monthly-spend').textContent = `$${(baselineTotal - 3850).toLocaleString()}`;
  
  const flaggedEc2 = state.ec2Instances.filter(i => i.status === 'flagged').length;
  const flaggedEbs = state.ebsVolumes.filter(v => v.status === 'unattached').length;
  const flaggedEip = state.elasticIps.filter(ip => ip.status === 'idle').length;
  const totalFlagged = flaggedEc2 + flaggedEbs + flaggedEip;
  document.getElementById('val-flagged-count').textContent = totalFlagged;

  updateCostChart();
  
  let activeTabName = state.activeTab;
  let tabCount = 0;
  if (activeTabName === 'ec2') {
    tabCount = flaggedEc2;
    document.getElementById('tab-badge-count').textContent = `${tabCount} Instances Flagged`;
  } else if (activeTabName === 'ebs') {
    tabCount = flaggedEbs;
    document.getElementById('tab-badge-count').textContent = `${tabCount} Volumes Flagged`;
  } else if (activeTabName === 'eip') {
    tabCount = flaggedEip;
    document.getElementById('tab-badge-count').textContent = `${tabCount} IPs Flagged`;
  }
}

function initCostChart() {
  const ctx = document.getElementById('costBreakdownChart').getContext('2d');
  
  const labelColor = state.theme === 'dark' ? '#9ca3af' : '#4b5563';
  
  costChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Compute (EC2)', 'Storage (EBS)', 'Networking (Elastic IPs)'],
      datasets: [{
        data: [state.costs.compute, state.costs.storage, state.costs.networking],
        backgroundColor: [
          '#6366f1', // Indigo
          '#06b6d4', // Cyan
          '#3b82f6'  // Blue
        ],
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: labelColor,
            font: {
              family: 'Inter',
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed !== null) {
                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed);
              }
              return label;
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}

function setChartCostState(mode) {
  state.chartState = mode;
  document.getElementById('chart-toggle-before').classList.toggle('active', mode === 'before');
  document.getElementById('chart-toggle-after').classList.toggle('active', mode === 'after');
  updateCostChart();
}

function updateCostChart() {
  if (!costChart) return;

  let computeVal, storageVal, networkingVal;
  
  if (state.chartState === 'before') {
    // Show original metrics
    computeVal = state.costs.compute;
    storageVal = state.costs.storage;
    networkingVal = state.costs.networking;
  } else {
    // Show optimized metrics
    computeVal = state.costs.compute - 2120; 
    storageVal = state.costs.storage - 1510; 
    networkingVal = state.costs.networking - 220; 
  }

  costChart.data.datasets[0].data = [computeVal, storageVal, networkingVal];
  costChart.update();
}

function switchTab(tabName) {
  state.activeTab = tabName;
  
  // Toggles active classes in tab headers
  document.getElementById('tab-ec2').classList.toggle('active', tabName === 'ec2');
  document.getElementById('tab-ebs').classList.toggle('active', tabName === 'ebs');
  document.getElementById('tab-eip').classList.toggle('active', tabName === 'eip');

  // Show selected panels
  document.getElementById('panel-ec2').classList.toggle('active', tabName === 'ec2');
  document.getElementById('panel-ebs').classList.toggle('active', tabName === 'ebs');
  document.getElementById('panel-eip').classList.toggle('active', tabName === 'eip');

  updateDashboardMetrics();
}

// -------------------------------------------------------------
// 7. Table Renderers & Actions
// -------------------------------------------------------------
function renderAllTables() {
  renderEc2Table();
  renderEbsTable();
  renderEipTable();
}

function renderEc2Table() {
  const tbody = document.getElementById('ec2-table-body');
  tbody.innerHTML = '';
  
  state.ec2Instances.forEach(instance => {
    const tr = document.createElement('tr');
    tr.id = `row-ec2-${instance.id}`;
    
    const isRightsized = instance.status === 'rightsized';
    
    tr.innerHTML = `
      <td>
        <span class="cell-bold">${instance.name}</span>
        <span class="cell-subtext">${instance.id}</span>
      </td>
      <td>${instance.region}</td>
      <td><span class="${isRightsized ? 'line-through text-muted' : 'cell-bold'}">${instance.currentType}</span></td>
      <td><span class="color-green font-semibold">${instance.recommendedType}</span></td>
      <td><span class="cpu-badge cpu-low">${instance.cpuAvg}</span></td>
      <td>$${instance.potentialSavings}/mo</td>
      <td class="text-right">
        ${isRightsized ? 
          `<span class="badge-success kpi-badge">✓ Rightsized</span>` : 
          `<button class="btn btn-sm btn-primary" onclick="rightsizeEc2('${instance.id}')">Rightsize</button>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderEbsTable() {
  const tbody = document.getElementById('ebs-table-body');
  tbody.innerHTML = '';
  
  state.ebsVolumes.forEach(vol => {
    const tr = document.createElement('tr');
    tr.id = `row-ebs-${vol.id}`;
    
    const isDeleted = vol.status === 'deleted';
    
    tr.innerHTML = `
      <td>
        <span class="cell-bold">${vol.name}</span>
        <span class="cell-subtext">${vol.id}</span>
      </td>
      <td>${vol.region}</td>
      <td>${vol.type}</td>
      <td>${vol.size} GB</td>
      <td>${vol.iops}</td>
      <td>$${vol.monthlyCost}/mo</td>
      <td class="text-right">
        ${isDeleted ? 
          `<span class="kpi-badge badge-warning">Deleted</span>` : 
          `<button class="btn btn-sm btn-secondary" onclick="deleteEbs('${vol.id}')">Purge Volume</button>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderEipTable() {
  const tbody = document.getElementById('eip-table-body');
  tbody.innerHTML = '';
  
  state.elasticIps.forEach(eip => {
    const tr = document.createElement('tr');
    tr.id = `row-eip-${eip.allocationId}`;
    
    const isReleased = eip.status === 'released';
    
    tr.innerHTML = `
      <td>
        <span class="cell-bold">${eip.ip}</span>
        <span class="cell-subtext">${eip.allocationId}</span>
      </td>
      <td>${eip.region}</td>
      <td>${eip.allocationId}</td>
      <td>${eip.idleTime}</td>
      <td>$${eip.monthlyCost.toFixed(2)}/mo</td>
      <td class="text-right">
        ${isReleased ? 
          `<span class="kpi-badge badge-warning">Released</span>` : 
          `<button class="btn btn-sm btn-secondary" onclick="releaseEip('${eip.allocationId}')">Release IP</button>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Specific Actions ---
function rightsizeEc2(id) {
  const inst = state.ec2Instances.find(i => i.id === id);
  if (inst && inst.status !== 'rightsized') {
    inst.status = 'rightsized';
    state.savings.ec2 += inst.potentialSavings;
    
    // Generate Code Snippet Preview
    state.selectedAction = {
      type: 'ec2',
      id: inst.id,
      name: inst.name,
      region: inst.region,
      oldType: inst.currentType,
      newType: inst.recommendedType
    };
    
    renderEc2Table();
    updateDashboardMetrics();
    updateCliConsole();
    showToast('EC2 Rightsized', `Modified ${inst.name} from ${inst.currentType} to ${inst.recommendedType}`, 'success');
  }
}

function deleteEbs(id) {
  const vol = state.ebsVolumes.find(v => v.id === id);
  if (vol && vol.status !== 'deleted') {
    vol.status = 'deleted';
    state.savings.ebs += vol.monthlyCost;
    
    state.selectedAction = {
      type: 'ebs',
      id: vol.id,
      name: vol.name,
      region: vol.region,
      cost: vol.monthlyCost
    };
    
    renderEbsTable();
    updateDashboardMetrics();
    updateCliConsole();
    showToast('Volume Deleted', `Initiated snapshot and deletion sequence for ${vol.id}`, 'warning');
  }
}

function releaseEip(allocId) {
  const eip = state.elasticIps.find(ip => ip.allocationId === allocId);
  if (eip && eip.status !== 'released') {
    eip.status = 'released';
    state.savings.eip += eip.monthlyCost;
    
    state.selectedAction = {
      type: 'eip',
      id: eip.allocationId,
      ip: eip.ip,
      region: eip.region,
      cost: eip.monthlyCost
    };
    
    renderEipTable();
    updateDashboardMetrics();
    updateCliConsole();
    showToast('IP Released', `Released Elastic IP address ${eip.ip} back to AWS pool`, 'success');
  }
}

// -------------------------------------------------------------
// 8. CLI Console Generator
// -------------------------------------------------------------
function switchCliTab(tab) {
  state.selectedCliTab = tab;
  document.getElementById('cli-tab-aws').classList.toggle('active', tab === 'aws');
  document.getElementById('cli-tab-tf').classList.toggle('active', tab === 'tf');
  updateCliConsole();
}

function updateCliConsole() {
  const container = document.getElementById('code-snippet-display');
  const action = state.selectedAction;
  
  if (!action) {
    container.textContent = `# No action queued. Click 'Rightsize' or 'Release/Delete' in tables to preview code here.`;
    return;
  }
  
  if (action.type === 'ec2') {
    if (state.selectedCliTab === 'aws') {
      container.textContent = `# AWS CLI Command to modify EC2 instance type\n` +
        `aws ec2 modify-instance-attribute \\\n` +
        `  --instance-id "${action.id}" \\\n` +
        `  --instance-type "{\\"Value\\": \\"${action.newType}\\"}" \\\n` +
        `  --region "${action.region}"\n\n` +
        `# Note: Instance must be stopped prior to changing instance type: \n` +
        `# aws ec2 stop-instances --instance-ids ${action.id} --region ${action.region}`;
    } else {
      container.textContent = `# Terraform configuration segment to rightsize instance\n` +
        `resource "aws_instance" "${action.name.replace(/-/g, '_')}" {\n` +
        `  ami           = "ami-0c55b159cbfafe1f0"\n` +
        `  instance_type = "${action.newType}" # Optimized from ${action.oldType}\n` +
        `  tags = {\n` +
        `    Name        = "${action.name}"\n` +
        `    Environment = "production"\n` +
        `  }\n` +
        `}`;
    }
  } else if (action.type === 'ebs') {
    if (state.selectedCliTab === 'aws') {
      container.textContent = `# Snapshot volume then delete it to prevent data loss\n` +
        `aws ec2 create-snapshot \\\n` +
        `  --volume-id "${action.id}" \\\n` +
        `  --description "Final snapshot before cost optimization purge" \\\n` +
        `  --region "${action.region}"\n\n` +
        `# Await completion then run:\n` +
        `aws ec2 delete-volume \\\n` +
        `  --volume-id "${action.id}" \\\n` +
        `  --region "${action.region}"`;
    } else {
      container.textContent = `# Terraform: Remove resource block to delete volume,\n` +
        `# or run import/state-rm to clean state metadata:\n` +
        `terraform state rm aws_ebs_volume.${action.name.replace(/-/g, '_')}`;
    }
  } else if (action.type === 'eip') {
    if (state.selectedCliTab === 'aws') {
      container.textContent = `# Release unassociated IP address to stop charges\n` +
        `aws ec2 release-address \\\n` +
        `  --allocation-id "${action.id}" \\\n` +
        `  --region "${action.region}"`;
    } else {
      container.textContent = `# Remove the resource block or exclude it from variables:\n` +
        `# terraform destroy -target=aws_eip.idle_ips["${action.ip}"]`;
    }
  }
}

function copyCodeSnippet() {
  const codeText = document.getElementById('code-snippet-display').textContent;
  const btnText = document.getElementById('copy-btn-text');
  
  navigator.clipboard.writeText(codeText).then(() => {
    btnText.textContent = 'Copied!';
    setTimeout(() => {
      btnText.textContent = 'Copy Code';
    }, 2000);
    showToast('Code Copied', 'AWS configuration script copied to clipboard.', 'success');
  }).catch(err => {
    console.error('Failed to copy text: ', err);
  });
}

// -------------------------------------------------------------
// 9. Runbook Tag Policy Validator
// -------------------------------------------------------------
const tagPresets = {
  valid: `{
  "Resource": "arn:aws:ec2:us-east-1:123456789012:instance/i-0cd23ef45gh678b",
  "Tags": {
    "Owner": "engineering-team",
    "Environment": "Prod",
    "CostCenter": "CC-9041",
    "Project": "CloudAudit"
  }
}`,
  invalid: `{
  "Resource": "arn:aws:ec2:us-east-1:123456789012:instance/i-0ab12cd34ef567a",
  "Tags": {
    "Owner": "intern-account",
    "Environment": "LocalSandbox"
  }
}`
};

function loadTagPreset(key) {
  const editor = document.getElementById('tag-json-editor');
  editor.value = tagPresets[key];
  validateTags();
}

function validateTags() {
  const editor = document.getElementById('tag-json-editor');
  const resultEl = document.getElementById('tag-validation-result');
  resultEl.classList.remove('hidden', 'validation-pass', 'validation-fail');
  
  try {
    const data = JSON.parse(editor.value);
    const tags = data.Tags || {};
    
    const required = ['Owner', 'Environment', 'CostCenter', 'Project'];
    const missing = [];
    
    required.forEach(key => {
      if (!tags.hasOwnProperty(key) || !tags[key]) {
        missing.push(key);
      }
    });

    // Check environment rules
    const allowedEnvs = ['Prod', 'Staging', 'Dev', 'QA'];
    let envValid = true;
    if (tags.Environment && !allowedEnvs.includes(tags.Environment)) {
      envValid = false;
    }

    if (missing.length === 0 && envValid) {
      resultEl.textContent = '✓ Validation Passed: Complies with tagging standard.';
      resultEl.classList.add('validation-pass');
    } else {
      let errorMsg = 'Failed: ';
      if (missing.length > 0) {
        errorMsg += `Missing tags: [${missing.join(', ')}]. `;
      }
      if (!envValid) {
        errorMsg += `Invalid Env: '${tags.Environment}' (Must be Prod, Staging, Dev, or QA).`;
      }
      resultEl.textContent = errorMsg;
      resultEl.classList.add('validation-fail');
    }
  } catch (e) {
    resultEl.textContent = 'Invalid JSON structure.';
    resultEl.classList.add('validation-fail');
  }
}

// -------------------------------------------------------------
// 10. Reserved Instance Savings Calculator
// -------------------------------------------------------------
const InstancePricingRates = {
  't3.large': { od: 0.0832, yr1: 0.0524, yr3: 0.0358 },
  'm6g.xlarge': { od: 0.154, yr1: 0.097, yr3: 0.0662 },
  'c6i.2xlarge': { od: 0.34, yr1: 0.214, yr3: 0.146 },
  'r6i.xlarge': { od: 0.252, yr1: 0.158, yr3: 0.108 }
};

function calculateRISavings() {
  const family = document.getElementById('ri-instance-family').value;
  const qty = parseInt(document.getElementById('ri-quantity').value) || 1;
  
  const rates = InstancePricingRates[family];
  const hoursPerMonth = 730; // standard AWS accounting month hours

  const odCost = rates.od * qty * hoursPerMonth;
  const yr1Cost = rates.yr1 * qty * hoursPerMonth;
  const yr3Cost = rates.yr3 * qty * hoursPerMonth;
  
  // Update view
  document.getElementById('ri-val-ondemand').textContent = `$${Math.round(odCost).toLocaleString()}`;
  document.getElementById('ri-val-1year').textContent = `$${Math.round(yr1Cost).toLocaleString()}`;
  document.getElementById('ri-val-3year').textContent = `$${Math.round(yr3Cost).toLocaleString()}`;
  
  const monthlySavings3Yr = odCost - yr3Cost;
  document.getElementById('calc-monthly-diff').textContent = `$${Math.round(monthlySavings3Yr).toLocaleString()}`;
}

// -------------------------------------------------------------
// 11. Budget Alert & Anomaly Simulator
// -------------------------------------------------------------
function updateAlertSliders() {
  const val = document.getElementById('input-warning-limit').value;
  document.getElementById('label-warning-limit').textContent = `$${val}/day`;
}

function simulateAnomaly(type) {
  const statusVal = document.getElementById('val-alert-status');
  const alertBadge = document.getElementById('active-rules-badge');
  const currentThreshold = document.getElementById('input-warning-limit').value;
  
  if (type === 'spike') {
    statusVal.textContent = 'Anomaly Alert!';
    statusVal.className = 'kpi-value color-red';
    alertBadge.className = 'kpi-badge badge-warning';
    alertBadge.textContent = 'Spike Active';
    
    // Show custom warning toasts
    showToast(
      '🚨 Cost Anomaly Detected',
      `EC2 spending spikes to $724.80/day, exceeding threshold ($${currentThreshold}/day). Webhook dispatched.`,
      'error'
    );
  } else {
    statusVal.textContent = 'All Normal';
    statusVal.className = 'kpi-value color-green';
    alertBadge.className = 'kpi-badge badge-info';
    alertBadge.textContent = '3 Rules';
    
    showToast(
      '✅ Spend Recovered',
      'Resource billing thresholds operating within bounds.',
      'success'
    );
  }
}

// -------------------------------------------------------------
// 12. Helper UI: Custom Toast Notifications
// -------------------------------------------------------------
function showToast(title, desc, type = 'info') {
  const container = document.getElementById('toast-container');
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-desc">${desc}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  container.appendChild(toast);
  
  // Auto dismiss after 5 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 5000);
}
