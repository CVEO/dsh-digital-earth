/**
 * Client plugin descriptor: locale dictionaries and every slot/tab/tool-view
 * registration. Byte-compatible with the v1.x `apply` body — same ids, keys,
 * injection order and `keepMounted` — only the factory wrapper is gone.
 */
import React from 'react'

import { MESSAGES } from './messages.js'
import { setAppCtx } from './runtime.js'
import { ViewerIcon } from './ui/icons.js'
import { EarthTabBody, ViewerPanel } from './ui/layout.js'
import { EarthToolRow, HeaderButton, ensureToolCss, openEarthPanel } from './ui/tool-row.js'

const h = React.createElement

    const plugin = {
      inject: ['slots', 'uiWorkspace', 'locale', 'theme'],
      apply(ctx) {
        setAppCtx(ctx)
        const NS = 'dsh-digital-earth'
        // Registered through ctx.effect so a hot reload disposes the old dictionaries
        // before the new ones land (the registry rejects duplicate namespaces).
        ctx.effect(
          () => ctx.locale.register(NS, { zh: MESSAGES.zh, en: MESSAGES.en }),
          'dsh-digital-earth: dictionaries',
        )
        const translate = ctx.locale.bind(NS)
        // The chat rows live outside the panel, so their styles must be global.
        ensureToolCss()
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: 'digital-earth',
              order: 30,
              label: () => translate('panel.title'),
              locale: NS,
            },
            ViewerIcon,
          ),
        )
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: 'digital-earth', locale: NS }, ViewerPanel),
        )
        // Session right sidebar: a page type plus its body. Both live inside the
        // same injected scope, so a hot reload disposes the type before
        // re-registering it.
        ctx.inject(['sidebarRightTabs'], (scope) => {
          scope.effect(
            () =>
              scope.sidebarRightTabs.register({
                id: 'dsh-digital-earth',
                kind: 'digital-earth',
                title: () => translate('tab.title'),
                keepMounted: true,
              }),
            'dsh-digital-earth: sidebar tab type',
          )
          scope.slots.inject('sidebar.right.pane.tab', () =>
            scope.slots.register(
              { name: 'sidebar.right.pane.tab', key: 'dsh-digital-earth', locale: NS },
              EarthTabBody,
            ),
          )
        })
        // A globe button on the conversation header keeps the panel one click away
        // from the chat, which is how the Agent-first workflow stays discoverable.
        // Keep it ahead of optional sidebar utilities so it does not get clipped
        // by header overflow on a busy profile.
        ctx.slots.inject('conversation.session.header.utilities', () =>
          ctx.slots.register(
            { name: 'conversation.session.header.utilities', id: 'digital-earth-open', order: -1, locale: NS },
            (props) => h(HeaderButton, { ...props, onOpen: openEarthPanel }),
          ),
        )
        // dsh-better-sidebar owns the empty-pane launcher (the card grid on the
        // Start page). Registering a tab there makes Digital Earth a first-class
        // card alongside Files / Git / Context; the integration is optional so a
        // profile without better-sidebar keeps the native panel path.
        ctx.inject(['betterSidebar'], (betterScope) => {
          const betterSidebar = betterScope.betterSidebar
          if (!betterSidebar || typeof betterSidebar.registerTab !== 'function') return
          betterScope.effect(
            () =>
              betterSidebar.registerTab({
                id: 'dsh-digital-earth',
                title: () => translate('panel.title'),
                description: () => translate('panel.description'),
                icon: (size) => h(ViewerIcon, { size }),
                order: 15,
                // One Digital Earth pane per session: clicking the start-page card
                // again should focus the existing tab, never stack duplicates.
                single: true,
                component: ({ scope: tabScope }) =>
                  h(EarthTabBody, { t: translate, sessionId: tabScope?.sessionId ?? null }),
              }),
            'dsh-digital-earth: better-sidebar tab',
          )
        })
        // The Agent drives the same panel through these six wire tools, so their
        // rows own the auto-open: the Host tool call waits for this tab to attach.
        ctx.slots.inject('tool.call.toolview', function* () {
          yield ctx.slots.register({ name: 'tool.call.toolview', key: 'earth_scene', locale: NS }, EarthToolRow)
          yield ctx.slots.register({ name: 'tool.call.toolview', key: 'earth_capture', locale: NS }, EarthToolRow)
          yield ctx.slots.register({ name: 'tool.call.toolview', key: 'earth_draw', locale: NS }, EarthToolRow)
          yield ctx.slots.register({ name: 'tool.call.toolview', key: 'earth_measure', locale: NS }, EarthToolRow)
          yield ctx.slots.register({ name: 'tool.call.toolview', key: 'earth_analyze', locale: NS }, EarthToolRow)
          yield ctx.slots.register({ name: 'tool.call.toolview', key: 'earth_shader', locale: NS }, EarthToolRow)
        })
      },
    }

export const inject = plugin.inject
export const apply = plugin.apply
export default plugin
