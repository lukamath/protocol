import {
  OptimisticOracleInterfaceEthers,
  OptimisticOracleInterfaceEthers__factory,
  getOptimisticOracleInterfaceAbi,
} from "@uma/contracts-node";
import type { SignerOrProvider, GetEventType } from "../..";
import { Event, BigNumberish, utils, BigNumber } from "ethers";

export type Instance = OptimisticOracleInterfaceEthers;
const Factory = OptimisticOracleInterfaceEthers__factory;

export function connect(address: string, provider: SignerOrProvider): Instance {
  return Factory.connect(address, provider);
}

export const contractInterface = new utils.Interface(getOptimisticOracleInterfaceAbi());

export type RequestPrice = GetEventType<Instance, "RequestPrice">;
export type ProposePrice = GetEventType<Instance, "ProposePrice">;
export type DisputePrice = GetEventType<Instance, "DisputePrice">;
export type Settle = GetEventType<Instance, "Settle">;

export enum RequestState {
  Invalid = 0, // Never requested.
  Requested, // Requested, no other actions taken.
  Proposed, // Proposed, but not expired or disputed yet.
  Expired, // Proposed, not disputed, past liveness.
  Disputed, // Disputed, but no DVM price returned yet.
  Resolved, // Disputed and DVM price is available.
  Settled, // Final price has been set in the contract (can get here from Expired or Resolved).
}

// all events have these values
export type RequestKey = {
  requester: string;
  identifier: string;
  timestamp: number;
  ancillaryData: string;
};
export type Request = RequestKey &
  // this is partial since we dont know what events we have to populate parts of this
  Partial<{
    proposer: string;
    disputer: string;
    currency: string;
    settled: boolean;
    refundOnDispute: boolean;
    proposedPrice: BigNumber;
    resolvedPrice: BigNumber;
    expirationTime: BigNumber;
    reward: BigNumber;
    finalFee: BigNumber;
    bond: BigNumber;
    customLiveness: BigNumber;
    price: BigNumber;
    payout: BigNumber;
    state: RequestState;
    // metadata about the transaction that triggered the state changes
    requestTx: string;
    proposeTx: string;
    disputeTx: string;
    settleTx: string;
    requestBlockNumber: number;
    proposeBlockNumber: number;
    disputeBlockNumber: number;
    settleBlockNumber: number;
  }>;

export interface EventState {
  requests?: Record<string, Request>;
}

export function requestId(request: Omit<RequestKey, "timestamp"> & { timestamp: BigNumberish }): string {
  // if enabling sorting, put timestamp first
  return [request.timestamp.toString(), request.identifier, request.requester, request.ancillaryData].join("!");
}

export function reduceEvents(state: EventState, event: Event): EventState {
  switch (event.event) {
    case "RequestPrice": {
      const typedEvent = event as RequestPrice;
      const { requester, identifier, timestamp, ancillaryData, currency, reward, finalFee } = typedEvent.args;
      const id = requestId(typedEvent.args);
      if (!state.requests) state.requests = {};
      const request: Request = state.requests[id] || {
        requester,
        identifier,
        timestamp,
        ancillaryData,
      };
      state.requests[id] = {
        ...request,
        currency,
        reward,
        finalFee,
        state: RequestState.Requested,
        requestTx: event.transactionHash,
        requestBlockNumber: event.blockNumber,
      };
      break;
    }
    case "ProposePrice": {
      const typedEvent = event as ProposePrice;
      const {
        requester,
        identifier,
        timestamp,
        ancillaryData,
        proposer,
        proposedPrice,
        expirationTimestamp,
        currency,
      } = typedEvent.args;
      const id = requestId(typedEvent.args);
      if (!state.requests) state.requests = {};
      const request: Request = state.requests[id] || {
        requester,
        identifier,
        timestamp,
        ancillaryData,
      };
      state.requests[id] = {
        ...request,
        currency,
        proposer,
        proposedPrice,
        expirationTime: expirationTimestamp,
        state: RequestState.Proposed,
        proposeTx: event.transactionHash,
        proposeBlockNumber: event.blockNumber,
      };
      break;
    }
    case "DisputePrice": {
      const typedEvent = event as DisputePrice;
      const { requester, identifier, timestamp, ancillaryData, proposer, disputer, proposedPrice } = typedEvent.args;
      const id = requestId(typedEvent.args);
      if (!state.requests) state.requests = {};
      const request: Request = state.requests[id] || {
        requester,
        identifier,
        timestamp,
        ancillaryData,
      };
      state.requests[id] = {
        ...request,
        proposer,
        disputer,
        proposedPrice,
        state: RequestState.Disputed,
        disputeTx: event.transactionHash,
        disputeBlockNumber: event.blockNumber,
      };
      break;
    }
    case "Settle": {
      const typedEvent = event as Settle;
      const { requester, identifier, timestamp, ancillaryData, proposer, disputer, price, payout } = typedEvent.args;
      const id = requestId(typedEvent.args);
      if (!state.requests) state.requests = {};
      const request: Request = state.requests[id] || {
        requester,
        identifier,
        timestamp,
        ancillaryData,
      };
      state.requests[id] = {
        ...request,
        requester,
        proposer,
        disputer,
        price,
        payout,
        state: RequestState.Settled,
        settleTx: event.transactionHash,
        settleBlockNumber: event.blockNumber,
      };
      break;
    }
  }
  return state;
}
export function getEventState(events: Event[], eventState: EventState = {}): EventState {
  return events.reduce(reduceEvents, eventState);
}
