import { projectStatus } from '../meta/project-status.js';

function byNewest(a, b) {
  return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''));
}

function makeStatusBadge(passed) {
  return passed ? 'ready' : 'pending';
}

function summarizeValidation(validation = {}) {
  return {
    ...validation,
    commands: validation.commands || [],
    status: validation.status || 'pending',
    passed: validation.status === 'passed',
  };
}

export class DashboardService {
  constructor({
    architectureService,
    taskStore,
    eventStore,
    backgroundRunStore,
    agentRegistry,
    skillInstallService,
    metaCore,
    packageService,
    soulService,
    defenseMatrixService,
    networkSecurityService,
    evolutionService,
  }) {
    this.architectureService = architectureService;
    this.taskStore = taskStore;
    this.eventStore = eventStore;
    this.backgroundRunStore = backgroundRunStore;
    this.agentRegistry = agentRegistry;
    this.skillInstallService = skillInstallService;
    this.metaCore = metaCore;
    this.packageService = packageService;
    this.soulService = soulService;
    this.defenseMatrixService = defenseMatrixService;
    this.networkSecurityService = networkSecurityService;
    this.evolutionService = evolutionService;
  }

  getHomeReport() {
    const tasks = this.taskStore.list().slice().sort(byNewest);
    const runs = this.backgroundRunStore.list().slice().sort(byNewest);
    const installs = this.skillInstallService.getRecords().slice().sort(byNewest);
    const layers = this.architectureService.getRuntimeLayers({
      tasks,
      backgroundRuns: runs,
      installRecords: installs,
    });
    const modes = this.architectureService.getRuntimeModes({ tasks, backgroundRuns: runs });
    const evolution = this.architectureService.getEvolutionReport({
      tasks,
      backgroundRuns: runs,
      installRecords: installs,
    });
    const soul = this.soulService.getHomeReport({ tasks, backgroundRuns: runs });
    const defense = this.defenseMatrixService.getHomeReport({ tasks, backgroundRuns: runs, installRecords: installs });
    const networkSecurity = this.networkSecurityService.getHomeReport({
      tasks,
      backgroundRuns: runs,
      installRecords: installs,
    });
    const selfEvolution = this.evolutionService.getGovernanceReport({
      tasks,
      backgroundRuns: runs,
      installRecords: installs,
    });
    const qualityGates = projectStatus.quality_gates.map((gate) => ({
      ...gate,
      status: makeStatusBadge(gate.passed),
    }));
    const candidateReady = qualityGates.every((gate) => gate.passed);
    const recentTasks = tasks.slice(0, 6).map((task) => ({
      task_id: task.task_id,
      goal: task.goal || String(task.input || '').slice(0, 120),
      status: task.status,
      mode: task.mode,
      product_track: task.product_track || 'runtime-studio',
      updated_at: task.updated_at,
      evidence_count: task.evidence?.length || 0,
      verify_passed: Boolean(task.verification?.passed),
      carried_versions: task.evolution_mapping?.carried_versions || [],
      route_summary: task.runtime_chain?.route_summary || null,
    }));
    const recentRuns = runs.slice(0, 4).map((run) => ({
      run_id: run.run_id,
      type: run.type,
      status: run.lifecycle?.status || run.status || 'completed',
      learned_count: run.learner?.learned_count || 0,
      created_at: run.created_at,
    }));
    const acceptedInstalls = installs.filter((record) => record.accepted);
    const escalatedTasks = tasks.filter((task) => task.status === 'escalated');
    const failedTasks = tasks.filter((task) => task.status === 'failed' || task.status === 'blocked');
    const closedTasks = tasks.filter((task) => task.status === 'closed');

    const nextSteps = [];
    if (!tasks.length) {
      nextSteps.push({
        id: 'create-demo-task',
        title: '鍏堝垱寤轰竴涓?deliberate 鎴?federated 绀轰緥浠诲姟',
        reason: '褰撳墠杩樻病鏈変换鍔★紝鍏堜骇鍑虹涓€鏉″彲瑙傛祴閾捐矾銆?,
        action: 'task-form',
      });
    }
    if (!modes.find((mode) => mode.id === 'background')?.used_count) {
      nextSteps.push({
        id: 'run-dream-cycle',
        title: '璺戜竴娆″悗鍙?dream cycle',
        reason: '璁?L5 Evolution Layer 鍦ㄩ椤电暀涓嬬湡瀹炶繍琛岀棔杩广€?,
        action: 'run-dream',
      });
    }
    if (!acceptedInstalls.length) {
      nextSteps.push({
        id: 'validate-skill-install',
        title: '鐢?skill-pack 杞ㄩ亾鍐嶈窇涓€娆″畨瑁?/ 楠屾敹',
        reason: '纭繚 package 鈫?.skill 鈫?install 鈫?verify 涓婚摼鍦ㄥ綋鍓嶇増鏈彲瑙併€?,
        action: 'task-form-skill-pack',
      });
    }
    if (escalatedTasks.length) {
      nextSteps.push({
        id: 'clear-escalations',
        title: `澶勭悊 ${escalatedTasks.length} 鏉″緟瀹℃壒浠诲姟`,
        reason: '灏佹澘鍊欓€夐椤靛簲灏介噺淇濇寔鈥滃凡鍏抽棴鎴栧凡鐭ラ闄┾€濈姸鎬併€?,
        action: 'task-list',
      });
    }
    if (failedTasks.length) {
      nextSteps.push({
        id: 'review-failures',
        title: `妫€鏌?${failedTasks.length} 鏉″け璐?闃诲浠诲姟`,
        reason: '鎶婂け璐ュ師鍥犵暀鍦ㄥ彲瑙傛祴闈㈡澘锛屼笉瑕佽鍊欓€夌姸鎬佹ā绯娿€?,
        action: 'task-list',
      });
    }
    if (!nextSteps.length) {
      nextSteps.push({
        id: 'candidate-ready',
        title: '褰撳墠宸茶繘鍏ョ粓鏋佺増灏佹澘鍊欓€夛紝鍙仛鏈€缁堜汉宸ラ獙鏀?,
        reason: '棣栭〉銆佷竷灞傘€佸洓绉嶆ā寮忋€佹紨杩涙槧灏勩€佽娴嬮摼涓庝氦浠橀摼閮藉凡灏变綅銆?,
        action: 'release-report',
      });
    }

    return {
      project: {
        slug: 'agentx-3.0',
        name: '人体智能体协作模式-多智能体架构系统',
        mission: this.metaCore.mission.current,
        success_criteria: this.metaCore.mission.successCriteria,
      },
      verdict: {
        stage: projectStatus.stage,
        stage_label: projectStatus.stage_label,
        candidate_ready: candidateReady && projectStatus.candidate_ready,
        scope: projectStatus.scope,
        summary: projectStatus.summary,
      },
      validation: summarizeValidation(projectStatus.validation),
      release_focus: projectStatus.release_focus,
      quality_gates: qualityGates,
      boundaries: projectStatus.boundaries,
      kpis: {
        total_tasks: tasks.length,
        closed_tasks: closedTasks.length,
        escalated_tasks: escalatedTasks.length,
        background_runs: runs.length,
        accepted_skill_installs: acceptedInstalls.length,
        registry_agents: this.agentRegistry.list().length,
      },
      layers,
      modes,
      evolution,
      soul,
      defense,
      network_security: networkSecurity,
      self_evolution: selfEvolution,
      key_entries: [
        {
          id: 'home-report',
          title: '棣栭〉姹囨姤',
          description: '鐩存帴鐪嬪綋鍓嶆槸鍚﹁揪鍒板皝鏉垮€欓€夛紝浠ュ強鏈疆閲嶇偣鍜岃竟鐣屻€?,
          target: '#section-home',
        },
        {
          id: 'architecture-board',
          title: '涓冨眰涓庡洓妯″紡',
          description: '鐪?L0-L6 涓庡洓绉嶆ā寮忕殑褰撳墠鐘舵€併€佺敤閫斾笌寤鸿鍏ュ彛銆?,
          target: '#section-architecture',
        },
        {
          id: 'soul-board',
          title: '鐏垫€?/ 涓夐瓊 / 涓冮瓌',
          description: '鏌ョ湅瑙夐啋鐘舵€併€佷笁榄傛槧灏勩€佷竷榄勯槻寰＄煩闃典笌鍙楁帶杈圭晫銆?,
          target: '#section-soul',
        },
        {
          id: 'network-security-board',
          title: '缃戠粶瀹夊叏閰嶇疆灞?,
          description: '鏌ョ湅鍏ュ彛缁戝畾銆佽仈閭﹁竟鐣屻€佸嚭鍙ｅ鎵广€佸瘑閽ュ皝瑁呬笌瀹¤鍥炴粴銆?,
          target: '#section-network-security',
        },
        {
          id: 'evolution-board',
          title: '鑷垜杩涘寲绯荤粺',
          description: '鏌ョ湅 capsule銆佸鏍搁摼銆侀樁娈点€佸洖婊氳竟鐣屼笌鏈€鏂板缓璁€?,
          target: '#section-evolution-system',
        },
        {
          id: 'task-console',
          title: '浠诲姟鎺у埗鍙?,
          description: '鍒涘缓 deliberate / reflex / background / federated 浠诲姟骞舵煡鐪嬭仛鍚堝伐浣滃彴銆?,
          target: '#section-tasks',
        },
        {
          id: 'package-chain',
          title: 'Package / Skill / Install / Verify',
          description: '鍦ㄥ悓涓€宸ヤ綔闈㈠唴鏌ョ湅 bundle.zip銆?skill銆佸畨瑁呭洖鎵у拰楠屾敹缁撴灉銆?,
          target: '#section-workbench',
        },
      ],
      next_steps: nextSteps,
      recent_tasks: recentTasks,
      recent_runs: recentRuns,
      install_summary: {
        total: installs.length,
        accepted: acceptedInstalls.length,
        latest: installs[0] || null,
      },
    };
  }
}


