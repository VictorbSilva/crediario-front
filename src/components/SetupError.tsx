export function SetupError({ erro }: { erro: unknown }) {
  const mensagem =
    erro instanceof Error ? erro.message : 'Erro desconhecido ao iniciar o app.'

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-3 text-lg font-semibold text-slate-900">
          O app não conseguiu iniciar
        </h1>
        <pre className="mb-4 overflow-x-auto whitespace-pre-wrap rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {mensagem}
        </pre>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>
            Crie um projeto no{' '}
            <span className="font-medium text-slate-900">console do Firebase</span> e
            registre um app Web.
          </li>
          <li>
            Ative <span className="font-medium text-slate-900">Authentication → E-mail/senha</span>.
          </li>
          <li>
            Copie <code className="rounded bg-slate-100 px-1">.env.example</code> para{' '}
            <code className="rounded bg-slate-100 px-1">.env.local</code> e preencha os
            valores.
          </li>
          <li>Reinicie o servidor de desenvolvimento.</li>
        </ol>
      </div>
    </main>
  )
}
