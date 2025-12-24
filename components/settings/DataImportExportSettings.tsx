import React, { useState, useEffect } from 'react';
import type { Company, Bank, Broker, DebtType, InvestmentType, BusinessUnit, Assignment, ArbitrageCustomField, Investment, MarketPriceSnapshot, User, Role, Debt, ArbitrageOperation } from '../../types';
import DataImportExportPanel from '../DataImportExportPanel';


const DataImportExportSettings: React.FC<any> = (props) => {
    return (
        <div>
            <DataImportExportPanel
                companyData={props.companyData}
                selectedCompany={props.selectedCompany}
                onDataImport={props.onDataImport}
                banks={props.banks}
                brokers={props.brokers}
                companies={props.companies}
                investmentTypes={props.investmentTypes}
                businessUnits={props.businessUnits}
                assignments={props.assignments}
                customFields={props.customFields}
                currencies={props.currencies}
            />
        </div>
    );
};
export default DataImportExportSettings;
