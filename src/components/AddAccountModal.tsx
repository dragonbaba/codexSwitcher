import { useEffect, useState } from "react";
import {
  describeFileSource,
  isTauriRuntime,
  openExternalUrl,
  pickAuthJsonFile,
  type FileSource,
} from "../lib/platform";

interface AddAccountModalProps {
  isOpen: boolean;
  initialTab?: Tab;
  onClose: () => void;
  onImportFile: (source: FileSource, name: string) => Promise<void>;
  onImportCurrentAuth: (name: string) => Promise<void>;
  onStartOAuth: (name: string) => Promise<{ auth_url: string }>;
  onCompleteOAuth: () => Promise<unknown>;
  onCancelOAuth: () => Promise<void>;
}

type Tab = "oauth" | "import" | "current";

export function AddAccountModal({
  isOpen,
  initialTab = "oauth",
  onClose,
  onImportFile,
  onImportCurrentAuth,
  onStartOAuth,
  onCompleteOAuth,
  onCancelOAuth,
}: AddAccountModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [name, setName] = useState("");
  const [fileSource, setFileSource] = useState<FileSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState(false);
  const [authUrl, setAuthUrl] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const isPrimaryDisabled = loading || (activeTab === "oauth" && oauthPending);
  const tauriRuntime = isTauriRuntime();

  useEffect(() => {
    if (!isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  const resetForm = () => {
    setActiveTab(initialTab);
    setName("");
    setFileSource(null);
    setError(null);
    setLoading(false);
    setOauthPending(false);
    setAuthUrl("");
  };

  const handleClose = () => {
    if (oauthPending) {
      onCancelOAuth();
    }
    resetForm();
    onClose();
  };

  const handleOAuthLogin = async () => {
    if (!name.trim()) {
      setError("请输入账号名称");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const info = await onStartOAuth(name.trim());
      setAuthUrl(info.auth_url);
      setOauthPending(true);
      setLoading(false);

      // 等待登录完成
      await onCompleteOAuth();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
      setOauthPending(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      const selected = await pickAuthJsonFile();
      if (selected) setFileSource(selected);
    } catch (err) {
      console.error("Failed to open file dialog:", err);
    }
  };

  const handleImportFile = async () => {
    if (!name.trim()) {
      setError("请输入账号名称");
      return;
    }
    if (!fileSource) {
      setError("请选择 auth.json 文件");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onImportFile(fileSource, name.trim());
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  const handleImportCurrentAuth = async () => {
    if (!name.trim()) {
      setError("请输入账号名称");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onImportCurrentAuth(name.trim());
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md mx-4 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100">添加账号</h2>
          <button
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-200 transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-800"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-slate-800">
          {(["oauth", "import", "current"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                if (tab !== "oauth" && oauthPending) {
                  void onCancelOAuth().catch((err) => {
                    console.error("Failed to cancel login:", err);
                  });
                  setOauthPending(false);
                  setLoading(false);
                }
                setActiveTab(tab);
                setError(null);
              }}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab
                  ? "text-green-400 border-b-2 border-green-500 -mb-px"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab === "oauth"
                ? "ChatGPT 登录"
                : tab === "import"
                  ? "导入文件"
                  : "当前 Auth"}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              账号名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：工作账号"
              className="w-full px-4 py-2.5 bg-slate-800/70 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50 transition-colors"
            />
          </div>

          {activeTab === "oauth" && (
            <div className="text-sm text-slate-400">
              {oauthPending ? (
                <div className="text-center py-4">
                  <div className="animate-spin h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                  <p className="text-slate-200 font-medium mb-2">正在等待浏览器完成登录...</p>
                  <p className="text-xs text-slate-500 mb-4">
                    请在浏览器中打开下面的链接继续：
                  </p>
                  <div className="flex items-center gap-2 mb-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
                    <input
                      type="text"
                      readOnly
                      value={authUrl}
                      className="flex-1 bg-transparent border-none text-xs text-slate-400 focus:outline-none focus:ring-0 truncate"
                    />
                    <button
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(authUrl)
                          .then(() => {
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          })
                          .catch(() => {
                            setError("剪贴板不可用，请手动复制链接。");
                          });
                      }}
                      className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer
                        ${copied
                          ? "border-green-500/30 bg-green-500/15 text-green-300"
                          : "border-slate-600 bg-slate-700/60 text-slate-300 hover:bg-slate-600"
                        }`}
                    >
                      {copied ? "已复制" : "复制"}
                    </button>
                    <button
                      onClick={() => {
                        void openExternalUrl(authUrl);
                      }}
                      className="px-3 py-1.5 bg-green-500 border border-green-500 rounded-lg text-xs font-medium text-slate-950 hover:bg-green-400 transition-colors shrink-0 cursor-pointer"
                    >
                      打开
                    </button>
                  </div>
                  {!tauriRuntime && (
                    <p className="text-xs text-amber-400">
                      由于回调会重定向到 localhost，OAuth 登录必须在当前这台机器上完成。
                    </p>
                  )}
                </div>
              ) : (
                <p>
                  点击下方按钮生成登录链接。你需要在浏览器中打开它并完成认证。
                </p>
              )}
            </div>
          )}

          {activeTab === "import" && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                选择 auth.json 文件
              </label>
              <div className="flex gap-2">
                <div className="flex-1 px-4 py-2.5 bg-slate-800/70 border border-slate-700 rounded-xl text-sm text-slate-400 truncate">
                  {describeFileSource(fileSource)}
                </div>
                <button
                  onClick={handleSelectFile}
                  className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  浏览...
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                从现有的 Codex auth.json 文件导入凭证
              </p>
            </div>
          )}

          {activeTab === "current" && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-green-200">
              <p className="font-medium mb-1">导入当前机器上的登录态</p>
              <p className="text-green-300/70">
                这会导入当前保存在本机
                <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-green-300">~/.codex/auth.json</code>
                文件中的 auth 数据，并保存为托管账号。
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-800">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={
              activeTab === "oauth"
                ? handleOAuthLogin
                : activeTab === "import"
                  ? handleImportFile
                  : handleImportCurrentAuth
            }
            disabled={isPrimaryDisabled}
            className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl bg-green-500 hover:bg-green-400 text-slate-950 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "添加中..."
              : activeTab === "oauth"
                ? "生成登录链接"
                : activeTab === "import"
                  ? "导入"
                  : "导入当前 Auth"}
          </button>
        </div>
      </div>
    </div>
  );
}
