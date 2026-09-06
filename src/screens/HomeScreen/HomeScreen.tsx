import React from 'react';
import { MODULES } from '../../../constants';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import ToolList from '../../components/ToolList';

/**
 * Home screen for the app.
 *
 * Renders the primary landing content including the app title and the list of
 * available tool modules.
 *
 * @returns A React element containing a section header and a tool list.
 */
export default function HomeScreen() {
  return (
    <ScreenBody>
      <SectionHeader>ColdBoot</SectionHeader>
      <ToolList tools={MODULES} />
    </ScreenBody>
  );
}
