import React from 'react';
import {
  AccountsManager,
  CREATE_ACCOUNT_RECEIVABLE,
  DELETE_ACCOUNT_RECEIVABLE,
  MARK_ACCOUNT_RECEIVABLE_RECEIVED,
  MY_ACCOUNTS_RECEIVABLE_QUERY,
  UPDATE_ACCOUNT_RECEIVABLE,
  type AccountReceivableItem
} from './AccountsManager';

export {
  MY_ACCOUNTS_RECEIVABLE_QUERY,
  CREATE_ACCOUNT_RECEIVABLE,
  UPDATE_ACCOUNT_RECEIVABLE,
  MARK_ACCOUNT_RECEIVABLE_RECEIVED,
  DELETE_ACCOUNT_RECEIVABLE,
  type AccountReceivableItem
};

export function AccountsReceivable(): React.JSX.Element {
  return <AccountsManager initialTab="RECEIVABLE" />;
}
