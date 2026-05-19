export const IPC = {
  connections: {
    list: 'connections:list',
    save: 'connections:save',
    delete: 'connections:delete',
    test: 'connections:test',
    open: 'connections:open',
    close: 'connections:close',
    status: 'connections:status'
  },
  query: {
    run: 'query:run',
    cancel: 'query:cancel',
    update: 'query:update'
  },
  schema: {
    introspect: 'schema:introspect',
    sample: 'schema:sample'
  },
  ai: {
    settings: 'ai:settings',
    saveSettings: 'ai:saveSettings',
    generateQuery: 'ai:generateQuery',
    chat: 'ai:chat'
  },
  app: {
    platform: 'app:platform',
    openExternal: 'app:openExternal'
  }
} as const;
