#include "sbMurmurationUtilities.h"
#include <prio.h>
#include <prnetdb.h>
#include <stdio.h>
#include "nsISocketTransportService.h"
#include "nsISocketTransport.h"

NS_IMPL_ISUPPORTS1(sbMurmurationUtilities, sbIMurmurationUtilities)

sbMurmurationUtilities::sbMurmurationUtilities() 
{
}

sbMurmurationUtilities::~sbMurmurationUtilities()
{
}

NS_IMETHODIMP
sbMurmurationUtilities::GetIPAddress(nsISocketTransport *socket, nsAString& _retval)
{
	PRNetAddr ipAddr;
	char      buf[64];

	nsresult rv = socket->GetSelfAddr(&ipAddr);
	if (NS_SUCCEEDED(rv)) {
		rv = PR_NetAddrToString(&ipAddr, buf, sizeof(buf));
		if (NS_SUCCEEDED(rv)) {
			_retval.AssignLiteral(buf);
			return NS_OK;
		} else {
			return rv;
		}
	} else {
		return rv;
	}
}

