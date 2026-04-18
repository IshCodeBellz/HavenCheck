export type RootStackParamList = {
  Login: undefined;
  CarerTabs: undefined;
  ManagerTabs: undefined;
  AdminTabs: undefined;
  VisitDetail: { visitId: string };
  CarePlanSummary: { visitId: string };
  Checklist: { visitId: string; clientId?: string };
  Notes: { visitId: string };
  Schedules: undefined;
  Visits: undefined;
  Checklists: undefined;
  Carers: undefined;
  Dashboard: undefined;
  OpenShiftDetail: { shiftPostingId: string };
  OpenShiftNew: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
