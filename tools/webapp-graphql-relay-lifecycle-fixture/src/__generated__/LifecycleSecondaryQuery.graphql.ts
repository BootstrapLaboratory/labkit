/**
 * @generated SignedSource<<8b6b712bd23dfaa4ea3d3811852c0cbd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type LifecycleSecondaryQuery$variables = {
  id: string;
};
export type LifecycleSecondaryQuery$data = {
  readonly secondaryItem: {
    readonly id: string;
    readonly label: string;
  };
};
export type LifecycleSecondaryQuery = {
  response: LifecycleSecondaryQuery$data;
  variables: LifecycleSecondaryQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": "Item",
    "kind": "LinkedField",
    "name": "secondaryItem",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "label",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "LifecycleSecondaryQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "LifecycleSecondaryQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "a04348dfd409403c79169a9b7047fd94",
    "id": null,
    "metadata": {},
    "name": "LifecycleSecondaryQuery",
    "operationKind": "query",
    "text": "query LifecycleSecondaryQuery(\n  $id: ID!\n) {\n  secondaryItem(id: $id) {\n    id\n    label\n  }\n}\n"
  }
};
})();

(node as any).hash = "6658ac0438da5285f232cd3790f8e1c1";

export default node;
