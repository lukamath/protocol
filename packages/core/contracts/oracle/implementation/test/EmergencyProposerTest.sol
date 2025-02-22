// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.0;

import "../EmergencyProposer.sol";
import "../../../common/implementation/Testable.sol";

contract EmergencyProposerTest is EmergencyProposer, Testable {
    constructor(
        IERC20 _token,
        uint256 _quorum,
        GovernorV2 _governor,
        Finder _finder,
        address _executor,
        address _timerAddress
    ) EmergencyProposer(_token, _quorum, _governor, _finder, _executor) Testable(_timerAddress) {}

    function getCurrentTime() public view override(EmergencyProposer, Testable) returns (uint256) {
        return Testable.getCurrentTime();
    }
}
