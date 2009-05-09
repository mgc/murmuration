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
	NS_ENSURE_SUCCESS(rv, rv);

	PRStatus success;
	success = PR_NetAddrToString(&ipAddr, buf, sizeof(buf));
	NS_ENSURE_TRUE(success == PR_SUCCESS, NS_ERROR_FAILURE);

	CopyASCIItoUTF16(nsDependentCString(buf), _retval);
	return NS_OK;
}

