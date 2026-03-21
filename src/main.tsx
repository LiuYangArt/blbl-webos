import React from 'react';
import ReactDOM from 'react-dom/client';
import './generated/material-symbols-rounded-subset.css';
import App from './App';
import './styles/app.css';

type BootDiagnostics = {
  update?: (stage: string, detail?: string) => void;
  mounted?: () => void;
};

const diagnostics = (window as typeof window & { __biliBootDiag?: BootDiagnostics }).__biliBootDiag;

diagnostics?.update?.('main-module-loaded', '前端入口模块已开始执行');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

diagnostics?.update?.('react-render-dispatched', 'React 已提交首轮渲染，等待页面完成挂载');
