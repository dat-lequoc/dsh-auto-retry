/**
 * dsh-auto-retry browser half: the configuration page opened from this row on
 * Settings -> Plugins. Hand-written lazy-CJS factory; React.createElement only.
 * Writes go through the page-supplied form, fenced by the revision it read.
 */
window.__ModuleLoader__.load({
  id: 'dsh-auto-retry',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'dsh-auto-retry'
    const KEY = 'dsh-auto-retry#dsh-auto-retry'
    const DEFAULTS = { enabled: true, patterns: [], delaysSeconds: [5, 30, 60, 120, 300], maxRetries: 10 }

    const en = {
      summary: 'Retries failed model requests whose error message matches your patterns.',
      enabled: 'Retry matching failures automatically',
      patterns: 'Error message patterns',
      patternsHint: 'One per line. A failure retries when its message contains any line (case-insensitive).',
      delays: 'Backoff (seconds)',
      delaysHint: 'Wait before each retry, comma-separated. The last value repeats.',
      maxRetries: 'Max retries per step',
      maxRetriesHint: '0 keeps retrying until it succeeds or you stop the turn.',
      save: 'Save', saving: 'Saving…', reset: 'Discard changes',
      saved: 'Saved. Applies to the next failure.',
      failed: 'Could not save. The values may have changed elsewhere; reopen this page and try again.',
      invalidDelays: 'Enter whole seconds between 0 and 86400, separated by commas.',
      invalidMax: 'Enter a whole number, 0 or more.',
      unavailable: 'Live editing is unavailable here. Edit the dsh-auto-retry entry in your profile cordis.patch.yml instead.',
    }

    const color = {
      text: 'var(--dsw-alias-label-primary)',
      dim: 'var(--dsw-alias-label-secondary)',
      border: 'var(--dsw-alias-border-l1)',
      surface: 'var(--dsw-alias-bg-layer-2)',
      accent: 'var(--dsw-alias-brand-primary)',
      error: 'var(--dsw-alias-state-error-primary)',
      success: 'var(--dsw-alias-state-success-primary)',
    }
    const field = {
      boxSizing: 'border-box', width: '100%', padding: '8px 10px', borderRadius: 8,
      border: `1px solid ${color.border}`, background: color.surface, color: color.text,
      font: 'inherit', fontSize: 13,
    }
    const button = {
      borderRadius: 8, border: `1px solid ${color.border}`, padding: '6px 14px',
      background: 'transparent', color: color.text, cursor: 'pointer', font: 'inherit', fontSize: 13,
    }

    /** Parse "5, 30, 60" into whole seconds; null when any entry is invalid. */
    function parseDelays(text) {
      const parts = text.split(/[\s,]+/).filter(Boolean)
      if (parts.length === 0) return null
      const values = parts.map(Number)
      return values.every(n => Number.isInteger(n) && n >= 0 && n <= 86_400) ? values : null
    }

    function toDraft(value) {
      const v = { ...DEFAULTS, ...value }
      return {
        enabled: v.enabled !== false,
        patterns: (v.patterns ?? []).join('\n'),
        delays: (v.delaysSeconds ?? []).join(', '),
        maxRetries: String(v.maxRetries ?? DEFAULTS.maxRetries),
      }
    }

    function Label({ id, title, hint, children }) {
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        h('label', { htmlFor: id, style: { fontWeight: 600, fontSize: 13 } }, title),
        children,
        hint ? h('div', { id: `${id}-hint`, style: { fontSize: 12, color: color.dim } }, hint) : null)
    }

    function Page({ form, t }) {
      const state = form?.state
      const accepted = state?.value
      const [draft, setDraft] = React.useState(null)
      const [status, setStatus] = React.useState(null)
      const [saving, setSaving] = React.useState(false)
      const current = draft ?? toDraft(accepted)
      const edit = (patch) => { setDraft({ ...current, ...patch }); setStatus(null) }

      if (form === undefined || state?.status === 'unavailable') {
        return h('p', { style: { color: color.dim, fontSize: 13 } }, t('unavailable'))
      }
      const delays = parseDelays(current.delays)
      const max = Number(current.maxRetries)
      const maxValid = current.maxRetries.trim() !== '' && Number.isInteger(max) && max >= 0
      const writable = state.writable === true && state.status === 'ready'
      const canSave = writable && draft !== null && delays !== null && maxValid && !saving

      const save = async () => {
        if (!canSave) return
        setSaving(true)
        try {
          const patterns = current.patterns.split('\n').map(line => line.trim()).filter(Boolean)
          const ok = await form.mutate([
            { op: 'set', path: ['enabled'], value: current.enabled },
            { op: 'set', path: ['patterns'], value: patterns },
            { op: 'set', path: ['delaysSeconds'], value: delays },
            { op: 'set', path: ['maxRetries'], value: max },
          ], state.revision)
          setStatus(ok ? 'saved' : 'failed')
          if (ok) setDraft(null)
        } catch {
          setStatus('failed')
        } finally {
          setSaving(false)
        }
      }

      return h('form', {
        onSubmit: (event) => { event.preventDefault(); void save() },
        style: { display: 'flex', flexDirection: 'column', gap: 18, color: color.text, maxWidth: 640 },
      },
        h('label', { style: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' } },
          h('button', {
            type: 'button', role: 'switch', 'aria-checked': current.enabled, disabled: !writable,
            onClick: () => edit({ enabled: !current.enabled }),
            style: {
              width: 34, height: 20, borderRadius: 10, border: 'none', padding: 2, cursor: 'pointer',
              background: current.enabled ? color.accent : color.border, display: 'flex',
              justifyContent: current.enabled ? 'flex-end' : 'flex-start', transition: 'background 120ms',
            },
          }, h('span', { style: { width: 16, height: 16, borderRadius: 8, background: 'var(--dsw-alias-bg-base)' } })),
          t('enabled')),
        h(Label, { id: 'dar-patterns', title: t('patterns'), hint: t('patternsHint') },
          h('textarea', {
            id: 'dar-patterns', rows: 6, value: current.patterns, disabled: !writable, spellCheck: false,
            'aria-describedby': 'dar-patterns-hint',
            onChange: event => edit({ patterns: event.target.value }),
            style: { ...field, fontFamily: 'var(--dsw-font-mono, ui-monospace, monospace)', resize: 'vertical' },
          })),
        h(Label, { id: 'dar-delays', title: t('delays'), hint: delays === null ? t('invalidDelays') : t('delaysHint') },
          h('input', {
            id: 'dar-delays', type: 'text', value: current.delays, disabled: !writable,
            'aria-invalid': delays === null, 'aria-describedby': 'dar-delays-hint',
            onChange: event => edit({ delays: event.target.value }),
            style: { ...field, borderColor: delays === null ? color.error : color.border },
          })),
        h(Label, { id: 'dar-max', title: t('maxRetries'), hint: maxValid ? t('maxRetriesHint') : t('invalidMax') },
          h('input', {
            id: 'dar-max', type: 'number', min: 0, step: 1, value: current.maxRetries, disabled: !writable,
            'aria-invalid': !maxValid, 'aria-describedby': 'dar-max-hint',
            onChange: event => edit({ maxRetries: event.target.value }),
            style: { ...field, width: 120, borderColor: maxValid ? color.border : color.error },
          })),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          h('button', {
            type: 'submit', disabled: !canSave,
            style: { ...button, background: canSave ? color.accent : 'transparent', color: canSave ? 'var(--dsw-alias-bg-base)' : color.dim, borderColor: canSave ? color.accent : color.border },
          }, saving ? t('saving') : t('save')),
          draft !== null ? h('button', { type: 'button', style: button, onClick: () => { setDraft(null); setStatus(null) } }, t('reset')) : null,
          status ? h('span', { role: 'status', style: { fontSize: 12, color: status === 'saved' ? color.success : color.error } }, t(status)) : null))
    }

    function Entry(props) {
      return props.view === 'summary' ? props.t('summary') : h(Page, props)
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en }))
        ctx.slots.inject('plugins.row.config', () => ctx.slots.register(
          { name: 'plugins.row.config', key: KEY, locale: NS },
          Entry,
        ))
      },
    }
  },
})
