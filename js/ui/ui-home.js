/* ============================================================
 *  ui-home.js · 校门口首页
 *  校长欢迎语（按学段变话术）+ 今日概览 + 快捷入口
 * ============================================================ */

import { state, activeTeacher, teacherStyle } from '../store.js';
import { stageLabel, goSection, toast } from './ui-shell.js';
import { SAMPLE_PAPERS } from '../seed-data.js';

export function initHome() { /* 首页无常驻事件，渲染时绑定 */ }

export function renderHome() {
  const el = document.getElementById('section-home');
  const stage = state.settings.stage;
  const stageName = stageLabel(stage);
  const teacher = activeTeacher();
  const style = teacher ? teacherStyle(teacher.id, stage) : null;

  // 统计
  const graded = state.papers.filter((p) => p.grading.status === 'graded').length;
  const wrong = state.wrongNotes.filter((w) => !w.mastered).length;
  const aids = state.teachingAids.length;
  const oral = state.oral.sessions.length;

  // 校长寄语（按学段不同）
  const principal = {
    primary: '欢迎来到我们的小学部！在这里，拍照批改、兴趣教具和口语游戏都在等你，每答对一题都会点亮你的成长地图。',
    junior: '欢迎来到初中部。课桌支持拍照批改与错题根因分析，薄弱知识点会被自动串联，帮你把力气用在刀刃上。',
    senior: '欢迎来到高中部。系统会基于你的错题画像生成定制教学方案，精准定位失分点，高效提分。',
  }[stage];

  el.innerHTML = `
    <div class="hero">
      <h2>🏫 校长欢迎你，${state.settings.studentName || '同学'}！</h2>
      <p>${principal}</p>
      <p style="margin-top:8px;font-size:13px;opacity:0.85">
        当前学段：${stageName} · 班主任：${teacher ? teacher.avatar + ' ' + teacher.name : '未选择'}
        ${style ? ` —— "${style.greeting}"` : ''}
      </p>
    </div>

    <div class="stat-row" style="margin-bottom:16px">
      <div class="stat"><div class="stat-num">${graded}</div><div class="stat-label">已批改试卷</div></div>
      <div class="stat"><div class="stat-num">${wrong}</div><div class="stat-label">待攻克错题</div></div>
      <div class="stat"><div class="stat-num">${state.teachers.length}</div><div class="stat-label">任课老师</div></div>
      <div class="stat"><div class="stat-num">${state.subjects.length}</div><div class="stat-label">在办学科</div></div>
      <div class="stat"><div class="stat-num">${aids}</div><div class="stat-label">趣味教具</div></div>
      <div class="stat"><div class="stat-num">${oral}</div><div class="stat-label">口语练习</div></div>
    </div>

    <div class="card">
      <h3>🚀 快捷入口</h3>
      <div class="quick-row">
        <button class="btn btn-accent" data-go="desk">📖 打开 AI 学习课桌</button>
        <button class="btn" data-go="tools">🎨 生成兴趣教具</button>
        <button class="btn" data-go="profile">📊 查看学习画像</button>
        <button class="btn" data-go="oral">🗣 练英语口语</button>
        <button class="btn" data-go="teachers">🧑‍🏫 管理老师与学科</button>
        <button class="btn" data-go="startup">🚀 创业工坊</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title-row">
        <h3>📄 快速体验：一键载入示例试卷</h3>
        <span class="muted">示例卷会带题目位置，批改结果像素级精确</span>
      </div>
      <div class="quick-row" id="homeSamples">
        ${SAMPLE_PAPERS.map((s) => `
          <button class="btn" data-sample="${s.id}">${s.title}</button>
        `).join('')}
      </div>
    </div>
  `;

  el.querySelectorAll('[data-go]').forEach((b) => {
    b.onclick = () => goSection(b.dataset.go);
  });
  el.querySelectorAll('[data-sample]').forEach((b) => {
    b.onclick = () => {
      // 交给课桌页载入该示例卷
      sessionStorage.setItem('aischool:loadSample', b.dataset.sample);
      goSection('desk');
    };
  });
}
